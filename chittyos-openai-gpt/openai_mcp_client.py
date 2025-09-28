#!/usr/bin/env python3
"""
OpenAI MCP Client for ChittyOS
Uses OpenAI's new Responses API with native MCP support
to connect directly to ChittyMCP remote server
"""

import os
import json
from openai import OpenAI
from typing import List, Dict, Any, Optional

class ChittyOSOpenAIClient:
    """OpenAI client that connects to ChittyMCP via native MCP support"""

    def __init__(self):
        self.client = OpenAI(
            api_key=os.getenv("OPENAI_API_KEY")
        )

        # ChittyMCP server configuration
        self.chittymcp_url = os.getenv("CHITTYMCP_URL", "https://mcp.chitty.cc/mcp/stream")
        self.chitty_api_key = os.getenv("CHITTY_API_KEY")

        if not self.chitty_api_key:
            raise ValueError("CHITTY_API_KEY environment variable required")

    def create_response(
        self,
        user_input: str,
        model: str = "chitty-advanced",
        allowed_tools: Optional[List[str]] = None,
        require_approval: str = "never"
    ) -> Dict[str, Any]:
        """
        Create a response using OpenAI's Responses API with ChittyMCP server

        Args:
            user_input: The user's request
            model: OpenAI model to use
            allowed_tools: List of specific tools to allow from ChittyMCP
            require_approval: "always", "never", or dict with specific approval settings
        """

        # Configure MCP tool for ChittyMCP server
        mcp_tool = {
            "type": "mcp",
            "server_label": "ChittyMCP",
            "server_description": "ChittyOS comprehensive legal and business infrastructure platform",
            "server_url": self.chittymcp_url,
            "authorization": f"Bearer {self.chitty_api_key}",
            "require_approval": require_approval
        }

        # Add tool filtering if specified
        if allowed_tools:
            mcp_tool["allowed_tools"] = allowed_tools

        try:
            response = self.client.responses.create(
                model=model,
                tools=[mcp_tool],
                input=user_input
            )

            return {
                "success": True,
                "response": response,
                "output_text": response.output_text,
                "tool_calls": self._extract_tool_calls(response)
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "output_text": None,
                "tool_calls": []
            }

    def _extract_tool_calls(self, response) -> List[Dict[str, Any]]:
        """Extract MCP tool calls from the response"""
        tool_calls = []

        for output_item in response.output:
            if output_item.type == "mcp_list_tools":
                tool_calls.append({
                    "type": "tools_listed",
                    "server_label": output_item.server_label,
                    "tools_count": len(output_item.tools),
                    "tools": [tool.name for tool in output_item.tools]
                })
            elif output_item.type == "mcp_call":
                tool_calls.append({
                    "type": "tool_call",
                    "server_label": output_item.server_label,
                    "tool_name": output_item.name,
                    "arguments": json.loads(output_item.arguments) if output_item.arguments else {},
                    "output": output_item.output,
                    "error": output_item.error
                })
            elif output_item.type == "mcp_approval_request":
                tool_calls.append({
                    "type": "approval_request",
                    "server_label": output_item.server_label,
                    "tool_name": output_item.name,
                    "arguments": json.loads(output_item.arguments) if output_item.arguments else {},
                    "approval_request_id": output_item.id
                })

        return tool_calls

    def handle_approval(
        self,
        previous_response_id: str,
        approval_request_id: str,
        approve: bool = True
    ) -> Dict[str, Any]:
        """Handle approval for an MCP tool call"""

        try:
            response = self.client.responses.create(
                model="chitty-advanced",
                tools=[{
                    "type": "mcp",
                    "server_label": "ChittyMCP",
                    "server_url": self.chittymcp_url,
                    "authorization": f"Bearer {self.chitty_api_key}",
                    "require_approval": "always"
                }],
                previous_response_id=previous_response_id,
                input=[{
                    "type": "mcp_approval_response",
                    "approve": approve,
                    "approval_request_id": approval_request_id
                }]
            )

            return {
                "success": True,
                "response": response,
                "output_text": response.output_text
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "output_text": None
            }

# CLI interface for testing
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python openai_mcp_client.py \"<your question>\"")
        print("Example: python openai_mcp_client.py \"Create a legal case for Acme Corp\"")
        sys.exit(1)

    user_question = sys.argv[1]

    # Initialize client
    try:
        client = ChittyOSOpenAIClient()
        print(f"🤖 Connecting to ChittyMCP at {client.chittymcp_url}")
        print(f"❓ User Question: {user_question}")
        print("-" * 50)

        # Create response
        result = client.create_response(user_question)

        if result["success"]:
            print("✅ Response generated successfully!")
            print(f"📝 Output: {result['output_text']}")

            if result["tool_calls"]:
                print("\n🔧 Tool Calls:")
                for call in result["tool_calls"]:
                    print(f"  - {call['type']}: {call.get('tool_name', 'N/A')}")
        else:
            print(f"❌ Error: {result['error']}")

    except Exception as e:
        print(f"💥 Failed to initialize: {e}")
        sys.exit(1)