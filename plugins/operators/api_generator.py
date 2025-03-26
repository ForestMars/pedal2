"""
Operator to convert domain entities from a DDD model into API actions
"""

from typing import Any, Dict, Optional, Sequence

from airflow.models import BaseOperator
from airflow.utils.decorators import apply_defaults

from plugins.hooks.supabase_hook import SupabaseHook
from plugins.utils.node_executor import NodeExecutor


class APIGeneratorOperator(BaseOperator):
    """
    Operator that converts domain entities into API actions
    
    This operator takes a DDD model artifact, processes it using a Node.js script,
    and creates an API specification artifact with the derived API actions.
    """
    
    @apply_defaults
    def __init__(
        self,
        artifact_id: int,
        supabase_conn_id: str = 'supabase_default',
        *args, **kwargs
    ) -> None:
        """
        Initialize the API generator operator
        
        Args:
            artifact_id: The ID of the DDD model artifact to process
            supabase_conn_id: The Supabase connection ID to use
        """
        super().__init__(*args, **kwargs)
        self.artifact_id = artifact_id
        self.supabase_conn_id = supabase_conn_id
    
    def execute(self, context: Dict[str, Any]) -> int:
        """
        Execute the API generation operation
        
        Args:
            context: The Airflow task context
            
        Returns:
            The ID of the created API specification artifact
        """
        # Get the DDD model artifact
        hook = SupabaseHook(self.supabase_conn_id)
        ddd_artifact = hook.get_artifact(self.artifact_id)
        
        if not ddd_artifact:
            raise ValueError(f"Artifact with ID {self.artifact_id} not found")
        
        if ddd_artifact['type'] != 'DDD_MODEL':
            raise ValueError(f"Artifact with ID {self.artifact_id} is not a DDD model")
        
        # Process the DDD model to generate API actions
        self.log.info(f"Generating API from DDD model: {ddd_artifact['name']}")
        
        # Execute the API generator
        result = NodeExecutor.execute_processor('api_generator', {
            'ddd_model': ddd_artifact['content']
        })
        
        # Create an API specification artifact
        api_spec_artifact = {
            'name': f"API Specification for {ddd_artifact['name']}",
            'type': 'API_SPEC',
            'content': result,
            'createdBy': context['task_instance'].task_id,
            'parentId': ddd_artifact['id'],
            'status': 'PENDING_APPROVAL'
        }
        
        # Save the API specification artifact
        created_artifact = hook.create_artifact(api_spec_artifact)
        
        self.log.info(f"Created API specification artifact with ID: {created_artifact['id']}")
        
        # Get the next pipeline stage for approvals
        stage = hook.get_pipeline_stage_by_order(2)  # API Spec is stage 2
        
        # Create approval tasks for stakeholders
        # For a real implementation, you would query relevant stakeholders
        approval1 = {
            'artifactId': created_artifact['id'],
            'stakeholderId': 1,  # This should be dynamically determined
            'status': 'PENDING'
        }
        
        approval2 = {
            'artifactId': created_artifact['id'],
            'stakeholderId': 2,  # This should be dynamically determined
            'status': 'PENDING'
        }
        
        hook.create_approval(approval1)
        hook.create_approval(approval2)
        
        return created_artifact['id']
