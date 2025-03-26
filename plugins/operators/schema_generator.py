"""
Operator to generate Zod and database schemas from TypeSpec files
"""

from typing import Any, Dict, Optional, Sequence

from airflow.models import BaseOperator
from airflow.utils.decorators import apply_defaults

from plugins.hooks.supabase_hook import SupabaseHook
from plugins.utils.node_executor import NodeExecutor


class SchemaGeneratorOperator(BaseOperator):
    """
    Operator that generates Zod and database schemas from TypeSpec files
    
    This operator takes a TypeSpec artifact, processes it using a Node.js script,
    and creates both Zod schema and database schema artifacts.
    """
    
    @apply_defaults
    def __init__(
        self,
        artifact_id: int,
        supabase_conn_id: str = 'supabase_default',
        *args, **kwargs
    ) -> None:
        """
        Initialize the schema generator operator
        
        Args:
            artifact_id: The ID of the TypeSpec artifact to process
            supabase_conn_id: The Supabase connection ID to use
        """
        super().__init__(*args, **kwargs)
        self.artifact_id = artifact_id
        self.supabase_conn_id = supabase_conn_id
    
    def execute(self, context: Dict[str, Any]) -> Dict[str, int]:
        """
        Execute the schema generation operation
        
        Args:
            context: The Airflow task context
            
        Returns:
            A dictionary with IDs of the created schema artifacts
        """
        # Get the TypeSpec artifact
        hook = SupabaseHook(self.supabase_conn_id)
        typespec_artifact = hook.get_artifact(self.artifact_id)
        
        if not typespec_artifact:
            raise ValueError(f"Artifact with ID {self.artifact_id} not found")
        
        if typespec_artifact['type'] != 'TYPESPEC':
            raise ValueError(f"Artifact with ID {self.artifact_id} is not a TypeSpec")
        
        # Process the TypeSpec to generate Zod and database schemas
        self.log.info(f"Generating schemas from TypeSpec: {typespec_artifact['name']}")
        
        # Execute the schema generator
        result = NodeExecutor.execute_processor('schema_generator', {
            'typespec': typespec_artifact['content']
        })
        
        # Create a Zod schema artifact
        zod_schema_artifact = {
            'name': f"Zod Schema for {typespec_artifact['name']}",
            'type': 'ZOD_SCHEMA',
            'content': result['zod_schema'],
            'createdBy': context['task_instance'].task_id,
            'parentId': typespec_artifact['id'],
            'status': 'PENDING_APPROVAL'
        }
        
        # Save the Zod schema artifact
        created_zod_artifact = hook.create_artifact(zod_schema_artifact)
        
        self.log.info(f"Created Zod schema artifact with ID: {created_zod_artifact['id']}")
        
        # Create a database schema artifact
        db_schema_artifact = {
            'name': f"Database Schema for {typespec_artifact['name']}",
            'type': 'DB_SCHEMA',
            'content': result['db_schema'],
            'createdBy': context['task_instance'].task_id,
            'parentId': typespec_artifact['id'],
            'status': 'PENDING_APPROVAL'
        }
        
        # Save the database schema artifact
        created_db_artifact = hook.create_artifact(db_schema_artifact)
        
        self.log.info(f"Created database schema artifact with ID: {created_db_artifact['id']}")
        
        # Get the pipeline stages for approvals
        zod_stage = hook.get_pipeline_stage_by_order(4)  # Zod Schema is stage 4
        db_stage = hook.get_pipeline_stage_by_order(5)   # DB Schema is stage 5
        
        # Create approval tasks for Zod schema
        zod_approval1 = {
            'artifactId': created_zod_artifact['id'],
            'stakeholderId': 2,  # This should be dynamically determined
            'status': 'PENDING'
        }
        
        zod_approval2 = {
            'artifactId': created_zod_artifact['id'],
            'stakeholderId': 4,  # This should be dynamically determined
            'status': 'PENDING'
        }
        
        hook.create_approval(zod_approval1)
        hook.create_approval(zod_approval2)
        
        # Create approval tasks for database schema
        db_approval1 = {
            'artifactId': created_db_artifact['id'],
            'stakeholderId': 3,  # This should be dynamically determined
            'status': 'PENDING'
        }
        
        db_approval2 = {
            'artifactId': created_db_artifact['id'],
            'stakeholderId': 5,  # This should be dynamically determined
            'status': 'PENDING'
        }
        
        hook.create_approval(db_approval1)
        hook.create_approval(db_approval2)
        
        return {
            'zod_schema_id': created_zod_artifact['id'],
            'db_schema_id': created_db_artifact['id']
        }
