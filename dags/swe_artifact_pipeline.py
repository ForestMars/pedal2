"""
SWE Artifact Delivery Pipeline DAG

This DAG defines a workflow for processing software engineering artifacts through a delivery process.
It moves artifacts from PRD to domain entities, API actions, TypeSpec, and finally to Zod and database schemas.
Each step requires approvals from stakeholders to proceed.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Callable

from airflow import DAG
from airflow.models import Variable
from airflow.operators.python import PythonOperator
from airflow.utils.task_group import TaskGroup
from airflow.utils.trigger_rule import TriggerRule

from plugins.operators.prd_processor import PRDProcessorOperator
from plugins.operators.api_generator import APIGeneratorOperator
from plugins.operators.typespec_generator import TypeSpecGeneratorOperator
from plugins.operators.schema_generator import SchemaGeneratorOperator
from plugins.operators.approval_operator import ApprovalOperator, ManualApprovalOperator
from plugins.hooks.supabase_hook import SupabaseHook


# Default arguments for the DAG
default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

# Create the DAG
dag = DAG(
    'swe_artifact_pipeline',
    default_args=default_args,
    description='SWE Artifact Delivery Pipeline',
    schedule_interval=None,
    start_date=datetime(2023, 1, 1),
    catchup=False,
    tags=['swe', 'pipeline', 'artifacts'],
)

# Task to create a new PRD artifact (starting point)
def create_prd_artifact(**kwargs):
    """
    Create a new PRD artifact
    
    This is the starting point of the pipeline. It creates a new PRD artifact
    that will be processed through the pipeline.
    """
    prd_content = kwargs.get('prd_content', {})
    prd_name = kwargs.get('prd_name', 'New PRD')
    
    if not prd_content:
        raise ValueError('PRD content is required')
    
    hook = SupabaseHook()
    
    # Create the PRD artifact
    artifact = {
        'name': prd_name,
        'type': 'PRD',
        'content': prd_content,
        'createdBy': 'airflow',
        'status': 'PENDING_APPROVAL'
    }
    
    created_artifact = hook.create_artifact(artifact)
    
    # Create approval task for stakeholder
    approval = {
        'artifactId': created_artifact['id'],
        'stakeholderId': 1,  # This should be dynamically determined
        'status': 'PENDING'
    }
    
    hook.create_approval(approval)
    
    return created_artifact['id']

# Function to check if all stakeholder approvals are complete
def check_artifact_approvals(artifact_id, **kwargs):
    """
    Check if an artifact has all required approvals
    
    Args:
        artifact_id: The ID of the artifact to check
        
    Returns:
        True if approvals are complete, False otherwise
    """
    hook = SupabaseHook()
    artifact = hook.get_artifact(artifact_id)
    
    # Get pipeline stage for this artifact type
    stage = None
    for i in range(6):  # We have 6 stages
        potential_stage = hook.get_pipeline_stage_by_order(i)
        if potential_stage and potential_stage['artifactType'] == artifact['type']:
            stage = potential_stage
            break
    
    if not stage:
        # Could not find a stage, consider approvals complete
        return True
    
    # Get approvals for this artifact
    approvals = hook.get_approvals_for_artifact(artifact_id)
    
    # Count approved approvals
    approved_count = sum(1 for a in approvals if a['status'] == 'APPROVED')
    required_count = stage['requiredApprovals']
    
    return approved_count >= required_count

# Create the initial task to create a PRD artifact
create_prd_task = PythonOperator(
    task_id='create_prd',
    python_callable=create_prd_artifact,
    op_kwargs={
        'prd_name': '{{ dag_run.conf.prd_name }}',
        'prd_content': '{{ dag_run.conf.prd_content }}'
    },
    dag=dag,
)

# Task to check PRD approvals
check_prd_approvals = ApprovalOperator(
    task_id='check_prd_approvals',
    artifact_id='{{ task_instance.xcom_pull(task_ids="create_prd") }}',
    dag=dag,
)

# Process PRD to extract domain entities
process_prd_task = PRDProcessorOperator(
    task_id='process_prd',
    artifact_id='{{ task_instance.xcom_pull(task_ids="create_prd") }}',
    dag=dag,
)

# Check domain model approvals
check_ddd_approvals = ApprovalOperator(
    task_id='check_ddd_approvals',
    artifact_id='{{ task_instance.xcom_pull(task_ids="process_prd") }}',
    dag=dag,
)

# Generate API actions from domain entities
generate_api_task = APIGeneratorOperator(
    task_id='generate_api',
    artifact_id='{{ task_instance.xcom_pull(task_ids="process_prd") }}',
    dag=dag,
)

# Check API specification approvals
check_api_approvals = ApprovalOperator(
    task_id='check_api_approvals',
    artifact_id='{{ task_instance.xcom_pull(task_ids="generate_api") }}',
    dag=dag,
)

# Generate TypeSpec from API specification
generate_typespec_task = TypeSpecGeneratorOperator(
    task_id='generate_typespec',
    artifact_id='{{ task_instance.xcom_pull(task_ids="generate_api") }}',
    dag=dag,
)

# Check TypeSpec approvals
check_typespec_approvals = ApprovalOperator(
    task_id='check_typespec_approvals',
    artifact_id='{{ task_instance.xcom_pull(task_ids="generate_typespec") }}',
    dag=dag,
)

# Generate Zod and database schemas from TypeSpec
generate_schemas_task = SchemaGeneratorOperator(
    task_id='generate_schemas',
    artifact_id='{{ task_instance.xcom_pull(task_ids="generate_typespec") }}',
    dag=dag,
)

# Check Zod schema approvals
check_zod_approvals = ApprovalOperator(
    task_id='check_zod_approvals',
    artifact_id='{{ task_instance.xcom_pull(task_ids="generate_schemas", key="zod_schema_id") }}',
    dag=dag,
)

# Check database schema approvals
check_db_approvals = ApprovalOperator(
    task_id='check_db_approvals',
    artifact_id='{{ task_instance.xcom_pull(task_ids="generate_schemas", key="db_schema_id") }}',
    dag=dag,
)

# Set task dependencies
create_prd_task >> check_prd_approvals >> process_prd_task >> check_ddd_approvals >> generate_api_task
generate_api_task >> check_api_approvals >> generate_typespec_task >> check_typespec_approvals >> generate_schemas_task
generate_schemas_task >> [check_zod_approvals, check_db_approvals]

# Task to finalize the pipeline (only runs when both schema checks are complete)
def finalize_pipeline(**kwargs):
    """
    Finalize the pipeline
    
    This task runs after all schema approvals are complete. It can be used to
    perform any final actions, such as notifying stakeholders or triggering
    downstream processes.
    """
    ti = kwargs['ti']
    zod_schema_id = ti.xcom_pull(task_ids='generate_schemas', key='zod_schema_id')
    db_schema_id = ti.xcom_pull(task_ids='generate_schemas', key='db_schema_id')
    
    hook = SupabaseHook()
    zod_schema = hook.get_artifact(zod_schema_id)
    db_schema = hook.get_artifact(db_schema_id)
    
    # Log completion
    print(f"Pipeline completed successfully!")
    print(f"Generated Zod schema: {zod_schema['name']}")
    print(f"Generated DB schema: {db_schema['name']}")
    
    return {
        'zod_schema_id': zod_schema_id,
        'db_schema_id': db_schema_id,
        'status': 'completed'
    }

# Add finalization task
finalize_task = PythonOperator(
    task_id='finalize_pipeline',
    python_callable=finalize_pipeline,
    trigger_rule=TriggerRule.ALL_SUCCESS,  # Only run if both approvals succeed
    dag=dag,
)

[check_zod_approvals, check_db_approvals] >> finalize_task
