"""
Utility module for executing Node.js scripts from Python within Airflow
"""

import os
import json
import tempfile
import subprocess
from typing import Any, Dict, List, Optional, Union

class NodeExecutor:
    """
    Class for executing Node.js scripts with input/output processing
    """
    
    @staticmethod
    def execute_script(script: str, 
                       args: Optional[List[str]] = None, 
                       env_vars: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """
        Execute a Node.js script and return its output as parsed JSON
        
        Args:
            script: The script content to execute
            args: Optional list of arguments to pass to the script
            env_vars: Optional environment variables to set for the script
            
        Returns:
            The parsed JSON output from the script
        """
        # Create a temporary script file
        script_file = tempfile.NamedTemporaryFile(delete=False, suffix='.js')
        script_file.write(script.encode('utf-8'))
        script_file.close()
        
        try:
            # Set up environment variables
            env = os.environ.copy()
            if env_vars:
                env.update(env_vars)
            
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
                error_message = stderr.decode('utf-8')
                raise Exception(f"Node.js script execution failed: {error_message}")
            
            # Parse and return the JSON output
            output = stdout.decode('utf-8').strip()
            return json.loads(output)
            
        finally:
            # Clean up temporary file
            os.unlink(script_file.name)
    
    @staticmethod
    def execute_processor(processor_name: str, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a specific Node.js processor script
        
        Args:
            processor_name: The name of the processor script (without .js extension)
            input_data: The input data to pass to the processor
            
        Returns:
            The processed output data
        """
        # Get the absolute path to the processors directory
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        processor_path = os.path.join(base_dir, 'scripts', 'processors', f"{processor_name}.js")
        
        # Check if the processor exists
        if not os.path.exists(processor_path):
            raise FileNotFoundError(f"Processor script not found: {processor_path}")
        
        # Create a temporary input file
        input_file = tempfile.NamedTemporaryFile(delete=False, suffix='.json')
        input_file.write(json.dumps(input_data).encode('utf-8'))
        input_file.close()
        
        try:
            # Set up environment variables
            env = os.environ.copy()
            
            # Execute the processor
            cmd = ['node', processor_path, input_file.name]
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=env
            )
            stdout, stderr = process.communicate()
            
            if process.returncode != 0:
                error_message = stderr.decode('utf-8')
                raise Exception(f"Processor execution failed: {error_message}")
            
            # Parse and return the JSON output
            output = stdout.decode('utf-8').strip()
            return json.loads(output)
            
        finally:
            # Clean up temporary file
            os.unlink(input_file.name)
