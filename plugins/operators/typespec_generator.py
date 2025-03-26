"""
Operator to generate TypeSpec files from API specifications
"""

from typing import Any, Dict, Optional, Sequence

from airflow.models import BaseOperator
from airflow.utils.decorators import apply_defaults

from plugins.hooks.supabase_hook import SupabaseHook
from plugins.utils.node_executor import NodeExecutor


class TypeSpecGeneratorOperator(BaseOperator):
    """
    Operator that generates TypeSpec files from API specifications
    
    This operator takes an API specification artifact, processes it using a Node.js script,
    and creates a TypeSpec artifact with the generated TypeSpec definitions.
    """
    
    @apply_defaults
    def __init__(
        self,
        artifact_id: int,
        supabase_conn_id: str = 'supabase_default',
        *args, **kwargs
    ) -> None:
        """
        Initialize the TypeSpec generator operator
        
        Args:
            artifact_id: The ID of the API specification artifact to process
            supabase_conn_id: The Supabase connection ID to use
        """
        super().__init__(*args, **kwargs)
        self.artifact_id = artifact_id
        self.supabase_conn_id = supabase_conn_id
    
    def execute(self, context: Dict[str, Any]) -> int:
        """
        Execute the TypeSpec generation operation
        
        Args:
            context: The Airflow task context
            
        Returns:
            The ID of the created TypeSpec artifact
        """
        # Get the API specification artifact
        hook = SupabaseHook(self.supabase_conn_id)
        api_artifact = hook.get_artifact(self.artifact_id)
        
        if not api_artifact:
            raise ValueError(f"Artifact with ID {self.artifact_id} not found")
        
        if api_artifact['type'] != 'API_SPEC':
            raise ValueError(f"Artifact with ID {self.artifact_id} is not an API specification")
        
        # Process the API specification to generate TypeSpec files
        self.log.info(f"Generating TypeSpec from API specification: {api_artifact['name']}")
        
        # Execute the TypeSpec generator
        result = NodeExecutor.execute_processor('typespec_generator', {
            'api_spec': api_artifact['content']
        })
        
        # Create a TypeSpec artifact
        typespec_artifact = {
            'name': f"TypeSpec for {api_artifact['name']}",
            'type': 'TYPESPEC',
            'content': result,
            'createdBy': context['task_instance'].task_id,
            'parentId': api_artifact['id'],
            'status': 'PENDING_APPROVAL'
        }
        
        # Save the TypeSpec artifact
        created_artifact = hook.create_artifact(typespec_artifact)
        
        self.log.info(f"Created TypeSpec artifact with ID: {created_artifact['id']}")
        
        # Get the next pipeline stage for approvals
        stage = hook.get_pipeline_stage_by_order(3)  # TypeSpec is stage 3
        
        # Create approval task for stakeholder
        approval = {
            'artifactId': created_artifact['id'],
            'stakeholderId': 3,  # This should be dynamically determined
            'status': 'PENDING'
        }
        
        hook.create_approval(approval)
        
        return created_artifact['id']
