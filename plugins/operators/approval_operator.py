"""
Operator to handle approvals for artifacts in the pipeline
"""

from typing import Any, Dict, List, Optional, Sequence, Union

from airflow.models import BaseOperator
from airflow.utils.decorators import apply_defaults

from plugins.hooks.supabase_hook import SupabaseHook


class ApprovalOperator(BaseOperator):
    """
    Operator that checks if an artifact has the required approvals
    to move to the next stage in the pipeline
    """
    
    @apply_defaults
    def __init__(
        self,
        artifact_id: int,
        supabase_conn_id: str = 'supabase_default',
        *args, **kwargs
    ) -> None:
        """
        Initialize the approval operator
        
        Args:
            artifact_id: The ID of the artifact to check approvals for
            supabase_conn_id: The Supabase connection ID to use
        """
        super().__init__(*args, **kwargs)
        self.artifact_id = artifact_id
        self.supabase_conn_id = supabase_conn_id
    
    def execute(self, context: Dict[str, Any]) -> bool:
        """
        Execute the approval check operation
        
        Args:
            context: The Airflow task context
            
        Returns:
            True if the artifact has the required approvals, False otherwise
        """
        # Get the artifact
        hook = SupabaseHook(self.supabase_conn_id)
        artifact = hook.get_artifact(self.artifact_id)
        
        if not artifact:
            raise ValueError(f"Artifact with ID {self.artifact_id} not found")
        
        # Get the pipeline stage for this artifact type
        stage = None
        # Find the pipeline stage for this artifact type
        # In a real implementation, you would query the database directly
        # For simplicity, we use a different approach here
        for i in range(6):  # We have 6 stages
            potential_stage = hook.get_pipeline_stage_by_order(i)
            if potential_stage and potential_stage['artifactType'] == artifact['type']:
                stage = potential_stage
                break
        
        if not stage:
            raise ValueError(f"No pipeline stage found for artifact type {artifact['type']}")
        
        # Get the approvals for this artifact
        approvals = hook.get_approvals_for_artifact(self.artifact_id)
        
        # Count the number of approved approvals
        approved_count = sum(1 for approval in approvals if approval['status'] == 'APPROVED')
        
        # Check if the artifact has the required approvals
        required_approvals = stage['requiredApprovals']
        
        self.log.info(f"Artifact {self.artifact_id} has {approved_count}/{required_approvals} approvals")
        
        # If the artifact has the required approvals, update its status to APPROVED
        if approved_count >= required_approvals:
            self.log.info(f"Artifact {self.artifact_id} has the required approvals, updating status to APPROVED")
            hook.update_artifact(self.artifact_id, {'status': 'APPROVED'})
            return True
        
        return False


class ManualApprovalOperator(BaseOperator):
    """
    Operator that simulates a manual approval for an artifact
    
    This is a utility operator for testing and development purposes.
    In a real-world scenario, approvals would be handled by an external system
    or UI, not by an Airflow operator.
    """
    
    @apply_defaults
    def __init__(
        self,
        artifact_id: int,
        stakeholder_id: int,
        approve: bool = True,
        comment: Optional[str] = None,
        supabase_conn_id: str = 'supabase_default',
        *args, **kwargs
    ) -> None:
        """
        Initialize the manual approval operator
        
        Args:
            artifact_id: The ID of the artifact to approve
            stakeholder_id: The ID of the stakeholder performing the approval
            approve: Whether to approve or reject the artifact
            comment: Optional comment for the approval
            supabase_conn_id: The Supabase connection ID to use
        """
        super().__init__(*args, **kwargs)
        self.artifact_id = artifact_id
        self.stakeholder_id = stakeholder_id
        self.approve = approve
        self.comment = comment
        self.supabase_conn_id = supabase_conn_id
    
    def execute(self, context: Dict[str, Any]) -> None:
        """
        Execute the manual approval operation
        
        Args:
            context: The Airflow task context
        """
        # Get the hook
        hook = SupabaseHook(self.supabase_conn_id)
        
        # Get all approvals for this artifact and stakeholder
        approvals = hook.get_approvals_for_artifact(self.artifact_id)
        stakeholder_approvals = [a for a in approvals if a['stakeholderId'] == self.stakeholder_id]
        
        if not stakeholder_approvals:
            self.log.warning(f"No approval record found for artifact {self.artifact_id} and stakeholder {self.stakeholder_id}")
            return
        
        # Update the approval
        approval = stakeholder_approvals[0]
        status = 'APPROVED' if self.approve else 'REJECTED'
        
        self.log.info(f"Updating approval {approval['id']} to status: {status}")
        
        update_data = {
            'status': status
        }
        
        if self.comment:
            update_data['comment'] = self.comment
        
        hook.update_approval(approval['id'], update_data)
        
        # If the artifact was rejected, update its status as well
        if not self.approve:
            hook.update_artifact(self.artifact_id, {'status': 'REJECTED'})
            self.log.info(f"Artifact {self.artifact_id} was rejected")
