/**
 * Apache Airflow DAG for SWE artifact delivery pipeline
 */

const { DAG } = require('airflow');
const PrdProcessorOperator = require('../plugins/operators/prd_processor');
const ApiActionConverterOperator = require('../plugins/operators/api_action_converter');
const TypeSpecGeneratorOperator = require('../plugins/operators/typespec_generator');
const SchemaGeneratorOperator = require('../plugins/operators/schema_generator');
const SignOffOperator = require('../plugins/operators/sign_off_operator');
const SupabaseHook = require('../plugins/hooks/supabase_hook');

// Initialize Supabase hook to interact with database
const supabaseHook = new SupabaseHook();

/**
 * SWE artifact delivery pipeline DAG
 */
const dag = new DAG({
  dagId: 'swe_artifact_delivery_pipeline',
  description: 'Pipeline for processing SWE artifacts through a delivery process',
  schedule: null, // Manually triggered
  startDate: new Date(),
  catchup: false
});

/**
 * Task to initialize pipeline run
 */
async function initializePipeline(context) {
  const pipelineRun = await supabaseHook.createPipelineRun();
  context.setXcomValue('pipeline_run_id', pipelineRun.id);
  return pipelineRun;
}

/**
 * Task to process PRD and extract domain entities
 */
async function processPrd(context) {
  const pipelineRunId = context.getXcomValue('pipeline_run_id');
  const artifactId = context.getParam('prd_artifact_id');
  const stageId = 1; // Assuming stage ID 1 for PRD processing
  
  const operator = new PrdProcessorOperator(
    'process_prd',
    pipelineRunId,
    artifactId,
    stageId
  );
  
  const result = await operator.execute();
  context.setXcomValue('domain_model_artifact_id', result.artifactId);
  return result;
}

/**
 * Task to convert domain model to API actions
 */
async function convertToApiActions(context) {
  const pipelineRunId = context.getXcomValue('pipeline_run_id');
  const artifactId = context.getXcomValue('domain_model_artifact_id');
  const stageId = 2; // Assuming stage ID 2 for API action conversion
  
  const operator = new ApiActionConverterOperator(
    'convert_to_api_actions',
    pipelineRunId,
    artifactId,
    stageId
  );
  
  const result = await operator.execute();
  context.setXcomValue('api_model_artifact_id', result.artifactId);
  return result;
}

/**
 * Task to get product manager sign-off on API model
 */
async function getApiModelSignOff(context) {
  const pipelineRunId = context.getXcomValue('pipeline_run_id');
  const artifactId = context.getXcomValue('api_model_artifact_id');
  const stageId = 3; // Assuming stage ID 3 for API model sign-off
  const stakeholderIds = [1]; // Assuming stakeholder ID 1 for product manager
  
  const operator = new SignOffOperator(
    'get_api_model_sign_off',
    pipelineRunId,
    artifactId,
    stageId,
    stakeholderIds
  );
  
  const result = await operator.execute();
  context.setXcomValue('api_model_sign_off_id', result.stageExecutionId);
  return result;
}

/**
 * Task to generate TypeSpec from API model
 */
async function generateTypeSpec(context) {
  const pipelineRunId = context.getXcomValue('pipeline_run_id');
  const artifactId = context.getXcomValue('api_model_artifact_id');
  const stageId = 4; // Assuming stage ID 4 for TypeSpec generation
  
  const operator = new TypeSpecGeneratorOperator(
    'generate_typespec',
    pipelineRunId,
    artifactId,
    stageId
  );
  
  const result = await operator.execute();
  context.setXcomValue('typespec_artifact_id', result.artifactId);
  return result;
}

/**
 * Task to get engineering sign-off on TypeSpec
 */
async function getTypeSpecSignOff(context) {
  const pipelineRunId = context.getXcomValue('pipeline_run_id');
  const artifactId = context.getXcomValue('typespec_artifact_id');
  const stageId = 5; // Assuming stage ID 5 for TypeSpec sign-off
  const stakeholderIds = [2]; // Assuming stakeholder ID 2 for engineer
  
  const operator = new SignOffOperator(
    'get_typespec_sign_off',
    pipelineRunId,
    artifactId,
    stageId,
    stakeholderIds
  );
  
  const result = await operator.execute();
  context.setXcomValue('typespec_sign_off_id', result.stageExecutionId);
  return result;
}

/**
 * Task to generate schemas from TypeSpec
 */
async function generateSchemas(context) {
  const pipelineRunId = context.getXcomValue('pipeline_run_id');
  const artifactId = context.getXcomValue('typespec_artifact_id');
  const stageId = 6; // Assuming stage ID 6 for schema generation
  
  const operator = new SchemaGeneratorOperator(
    'generate_schemas',
    pipelineRunId,
    artifactId,
    stageId
  );
  
  const result = await operator.execute();
  context.setXcomValue('schema_artifact_id', result.artifactId);
  return result;
}

/**
 * Task to get final sign-off on schemas
 */
async function getFinalSignOff(context) {
  const pipelineRunId = context.getXcomValue('pipeline_run_id');
  const artifactId = context.getXcomValue('schema_artifact_id');
  const stageId = 7; // Assuming stage ID 7 for final sign-off
  const stakeholderIds = [1, 2, 3]; // PM, Engineer, Architect
  
  const operator = new SignOffOperator(
    'get_final_sign_off',
    pipelineRunId,
    artifactId,
    stageId,
    stakeholderIds
  );
  
  const result = await operator.execute();
  context.setXcomValue('final_sign_off_id', result.stageExecutionId);
  return result;
}

/**
 * Task to finalize pipeline
 */
async function finalizePipeline(context) {
  const pipelineRunId = context.getXcomValue('pipeline_run_id');
  
  // Update pipeline run to completed
  await supabaseHook.updatePipelineRun(pipelineRunId, {
    status: 'completed',
    endTime: new Date()
  });
  
  return {
    status: 'success',
    pipelineRunId,
    finalArtifactId: context.getXcomValue('schema_artifact_id')
  };
}

// Define DAG tasks
const initialize = dag.createPythonOperator({
  taskId: 'initialize_pipeline',
  pythonCallable: initializePipeline
});

const processPrdTask = dag.createPythonOperator({
  taskId: 'process_prd',
  pythonCallable: processPrd
});

const convertToApiActionsTask = dag.createPythonOperator({
  taskId: 'convert_to_api_actions',
  pythonCallable: convertToApiActions
});

const getApiModelSignOffTask = dag.createPythonOperator({
  taskId: 'get_api_model_sign_off',
  pythonCallable: getApiModelSignOff
});

const generateTypeSpecTask = dag.createPythonOperator({
  taskId: 'generate_typespec',
  pythonCallable: generateTypeSpec
});

const getTypeSpecSignOffTask = dag.createPythonOperator({
  taskId: 'get_typespec_sign_off',
  pythonCallable: getTypeSpecSignOff
});

const generateSchemasTask = dag.createPythonOperator({
  taskId: 'generate_schemas',
  pythonCallable: generateSchemas
});

const getFinalSignOffTask = dag.createPythonOperator({
  taskId: 'get_final_sign_off',
  pythonCallable: getFinalSignOff
});

const finalizeTask = dag.createPythonOperator({
  taskId: 'finalize_pipeline',
  pythonCallable: finalizePipeline
});

// Define task dependencies
initialize >> processPrdTask >> convertToApiActionsTask >> getApiModelSignOffTask;
getApiModelSignOffTask >> generateTypeSpecTask >> getTypeSpecSignOffTask;
getTypeSpecSignOffTask >> generateSchemasTask >> getFinalSignOffTask >> finalizeTask;

module.exports = dag;
