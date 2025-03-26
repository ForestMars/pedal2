"""
Supabase Hook for Airflow that connects to a Supabase database
and provides methods to interact with it using Drizzle ORM.
"""

import os
import json
import subprocess
from typing import Any, Dict, List, Optional, Union

from airflow.hooks.base import BaseHook
from airflow.models.connection import Connection


class SupabaseHook(BaseHook):
    """
    Hook for interacting with Supabase using Node.js and Drizzle ORM
    
    This hook runs Node.js scripts to interact with the Supabase database
    using the Drizzle ORM defined in the shared directory.
    """
    
    conn_name_attr = 'supabase_conn_id'
    default_conn_name = 'supabase_default'
    conn_type = 'supabase'
    hook_name = 'Supabase'
    
    def __init__(self, supabase_conn_id: str = default_conn_name) -> None:
        super().__init__()
        self.supabase_conn_id = supabase_conn_id
        self.connection = self.get_connection(supabase_conn_id)
        
    def get_conn(self) -> Connection:
        """Returns the connection object"""
        return self.connection
    
    def _run_node_script(self, script: str, args: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Run a Node.js script with the appropriate environment variables
        
        Args:
            script: The script content to execute
            args: Optional list of arguments to pass to the script
            
        Returns:
            The parsed JSON output from the script
        """
        # Create a temporary script file
        import tempfile
        script_file = tempfile.NamedTemporaryFile(delete=False, suffix='.js')
        script_file.write(script.encode('utf-8'))
        script_file.close()
        
        try:
            # Set up environment variables
            env = os.environ.copy()
            env['DATABASE_URL'] = self.connection.get_uri()
            
            # Prepare command
            cmd = ['node', script_file.name]
            if args:
                cmd.extend(args)
            
            # Execute the script
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=env
            )
            stdout, stderr = process.communicate()
            
            if process.returncode != 0:
                self.log.error(f"Node.js script execution failed: {stderr.decode('utf-8')}")
                raise Exception(f"Node.js script execution failed with exit code {process.returncode}")
            
            # Parse and return the JSON output
            output = stdout.decode('utf-8').strip()
            return json.loads(output)
            
        finally:
            # Clean up temporary file
            os.unlink(script_file.name)
    
    def get_artifact(self, artifact_id: int) -> Dict[str, Any]:
        """
        Get an artifact by ID
        
        Args:
            artifact_id: The ID of the artifact to retrieve
            
        Returns:
            The artifact data
        """
        script = """
        const { db } = require('./shared/db');
        const { artifacts } = require('./shared/schema');
        const { eq } = require('drizzle-orm');

        async function getArtifact(id) {
            const [artifact] = await db.select().from(artifacts).where(eq(artifacts.id, id));
            return artifact || null;
        }

        getArtifact(process.argv[2])
            .then(result => {
                console.log(JSON.stringify(result));
                process.exit(0);
            })
            .catch(error => {
                console.error(error);
                process.exit(1);
            });
        """
        return self._run_node_script(script, [str(artifact_id)])
    
    def create_artifact(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new artifact
        
        Args:
            data: The artifact data to insert
            
        Returns:
            The created artifact data
        """
        script = """
        const { db } = require('./shared/db');
        const { artifacts } = require('./shared/schema');

        async function createArtifact(artifactData) {
            const [artifact] = await db.insert(artifacts).values(JSON.parse(artifactData)).returning();
            return artifact;
        }

        createArtifact(process.argv[2])
            .then(result => {
                console.log(JSON.stringify(result));
                process.exit(0);
            })
            .catch(error => {
                console.error(error);
                process.exit(1);
            });
        """
        return self._run_node_script(script, [json.dumps(data)])
    
    def update_artifact(self, artifact_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update an existing artifact
        
        Args:
            artifact_id: The ID of the artifact to update
            data: The artifact data to update
            
        Returns:
            The updated artifact data
        """
        script = """
        const { db } = require('./shared/db');
        const { artifacts } = require('./shared/schema');
        const { eq } = require('drizzle-orm');

        async function updateArtifact(id, artifactData) {
            const [artifact] = await db.update(artifacts)
                .set({...JSON.parse(artifactData), updatedAt: new Date()})
                .where(eq(artifacts.id, id))
                .returning();
            return artifact;
        }

        updateArtifact(process.argv[2], process.argv[3])
            .then(result => {
                console.log(JSON.stringify(result));
                process.exit(0);
            })
            .catch(error => {
                console.error(error);
                process.exit(1);
            });
        """
        return self._run_node_script(script, [str(artifact_id), json.dumps(data)])
    
    def create_approval(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new approval record
        
        Args:
            data: The approval data to insert
            
        Returns:
            The created approval data
        """
        script = """
        const { db } = require('./shared/db');
        const { approvals } = require('./shared/schema');

        async function createApproval(approvalData) {
            const [approval] = await db.insert(approvals).values(JSON.parse(approvalData)).returning();
            return approval;
        }

        createApproval(process.argv[2])
            .then(result => {
                console.log(JSON.stringify(result));
                process.exit(0);
            })
            .catch(error => {
                console.error(error);
                process.exit(1);
            });
        """
        return self._run_node_script(script, [json.dumps(data)])
    
    def update_approval(self, approval_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update an existing approval
        
        Args:
            approval_id: The ID of the approval to update
            data: The approval data to update
            
        Returns:
            The updated approval data
        """
        script = """
        const { db } = require('./shared/db');
        const { approvals } = require('./shared/schema');
        const { eq } = require('drizzle-orm');

        async function updateApproval(id, approvalData) {
            const [approval] = await db.update(approvals)
                .set({...JSON.parse(approvalData), updatedAt: new Date()})
                .where(eq(approvals.id, id))
                .returning();
            return approval;
        }

        updateApproval(process.argv[2], process.argv[3])
            .then(result => {
                console.log(JSON.stringify(result));
                process.exit(0);
            })
            .catch(error => {
                console.error(error);
                process.exit(1);
            });
        """
        return self._run_node_script(script, [str(approval_id), json.dumps(data)])
    
    def get_approvals_for_artifact(self, artifact_id: int) -> List[Dict[str, Any]]:
        """
        Get all approvals for an artifact
        
        Args:
            artifact_id: The ID of the artifact
            
        Returns:
            List of approval records
        """
        script = """
        const { db } = require('./shared/db');
        const { approvals } = require('./shared/schema');
        const { eq } = require('drizzle-orm');

        async function getApprovalsForArtifact(artifactId) {
            const results = await db.select().from(approvals).where(eq(approvals.artifactId, artifactId));
            return results;
        }

        getApprovalsForArtifact(process.argv[2])
            .then(result => {
                console.log(JSON.stringify(result));
                process.exit(0);
            })
            .catch(error => {
                console.error(error);
                process.exit(1);
            });
        """
        return self._run_node_script(script, [str(artifact_id)])
    
    def get_pipeline_stage(self, stage_id: int) -> Dict[str, Any]:
        """
        Get a pipeline stage by ID
        
        Args:
            stage_id: The ID of the stage to retrieve
            
        Returns:
            The pipeline stage data
        """
        script = """
        const { db } = require('./shared/db');
        const { pipelineStages } = require('./shared/schema');
        const { eq } = require('drizzle-orm');

        async function getPipelineStage(id) {
            const [stage] = await db.select().from(pipelineStages).where(eq(pipelineStages.id, id));
            return stage || null;
        }

        getPipelineStage(process.argv[2])
            .then(result => {
                console.log(JSON.stringify(result));
                process.exit(0);
            })
            .catch(error => {
                console.error(error);
                process.exit(1);
            });
        """
        return self._run_node_script(script, [str(stage_id)])
    
    def get_pipeline_stage_by_order(self, order_index: int) -> Dict[str, Any]:
        """
        Get a pipeline stage by its order index
        
        Args:
            order_index: The order index of the stage
            
        Returns:
            The pipeline stage data
        """
        script = """
        const { db } = require('./shared/db');
        const { pipelineStages } = require('./shared/schema');
        const { eq } = require('drizzle-orm');

        async function getPipelineStageByOrder(orderIndex) {
            const [stage] = await db.select().from(pipelineStages).where(eq(pipelineStages.orderIndex, orderIndex));
            return stage || null;
        }

        getPipelineStageByOrder(process.argv[2])
            .then(result => {
                console.log(JSON.stringify(result));
                process.exit(0);
            })
            .catch(error => {
                console.error(error);
                process.exit(1);
            });
        """
        return self._run_node_script(script, [str(order_index)])
