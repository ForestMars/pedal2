"""
Operator to process a Product Requirements Document (PRD)
and extract domain entities for the DDD model
"""

from typing import Any, Dict, Optional, Sequence

from airflow.models import BaseOperator
from airflow.utils.decorators import apply_defaults

from plugins.hooks.supabase_hook import SupabaseHook
from plugins.utils.node_executor import NodeExecutor


class PRDProcessorOperator(BaseOperator):
    """
    Operator that processes a PRD artifact and extracts domain entities
    
    This operator takes a PRD artifact, processes it using a Node.js script,
    and creates a DDD model artifact with the extracted domain entities.
    """
    
    @apply_defaults
    def __init__(
        self,
        artifact_id: int,
        supabase_conn_id: str = 'supabase_default',
        *args, **kwargs
    ) -> None:
        """
        Initialize the PRD processor operator
        
        Args:
            artifact_id: The ID of the PRD artifact to process
            supabase_conn_id: The Supabase connection ID to use
        """
        super().__init__(*args, **kwargs)
        self.artifact_id = artifact_id
        self.supabase_conn_id = supabase_conn_id
    
    def execute(self, context: Dict[str, Any]) -> int:
        """
        Execute the PRD processing operation
        
        Args:
            context: The Airflow task context
            
        Returns:
            The ID of the created DDD model artifact
        """
        # Get the PRD artifact
        hook = SupabaseHook(self.supabase_conn_id)
        prd_artifact = hook.get_artifact(self.artifact_id)
        
        if not prd_artifact:
            raise ValueError(f"Artifact with ID {self.artifact_id} not found")
        
        if prd_artifact['type'] != 'PRD':
            raise ValueError(f"Artifact with ID {self.artifact_id} is not a PRD")
        
        # Process the PRD to extract domain entities
        self.log.info(f"Processing PRD artifact: {prd_artifact['name']}")
        
        # Execute the PRD processor
        result = NodeExecutor.execute_processor('prd_processor', {
            'prd': prd_artifact['content']
        })
        
        # Create a DDD model artifact
        ddd_model_artifact = {
            'name': f"DDD Model for {prd_artifact['name']}",
            'type': 'DDD_MODEL',
            'content': result,
            'createdBy': context['task_instance'].task_id,
            'parentId': prd_artifact['id'],
            'status': 'PENDING_APPROVAL'
        }
        
        # Save the DDD model artifact
        created_artifact = hook.create_artifact(ddd_model_artifact)
        
        self.log.info(f"Created DDD model artifact with ID: {created_artifact['id']}")
        
        # Get the next pipeline stage for approvals
        stage = hook.get_pipeline_stage_by_order(1)  # DDD Model is stage 1
        
        # Create approval tasks for stakeholders
        # In a real implementation, you would query stakeholders from the database
        # For simplicity, we're creating a single approval task here
        approval = {
            'artifactId': created_artifact['id'],
            'stakeholderId': 1,  # This should be dynamically determined
            'status': 'PENDING'
        }
        
        hook.create_approval(approval)
        
        return created_artifact['id']
