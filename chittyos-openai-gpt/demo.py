#!/usr/bin/env python3
"""
ChittyOS + OpenAI MCP Integration Demo
Demonstrates native MCP connection to ChittyMCP server
"""

import os
import sys
from openai_mcp_client import ChittyOSOpenAIClient

def main():
    print("🏛️ ChittyOS + OpenAI MCP Integration Demo")
    print("=" * 50)

    # Demo scenarios
    scenarios = [
        {
            "name": "Legal Case Creation",
            "prompt": "Create a legal case for Acme Corporation regarding a contract dispute",
            "tools": ["create_legal_case", "search_cases"]
        },
        {
            "name": "Document Analysis",
            "prompt": "Analyze a legal document for potential compliance issues",
            "tools": ["analyze_document", "compliance_check"]
        },
        {
            "name": "Financial Transaction",
            "prompt": "Process a $50,000 payment for legal services to Acme Corp",
            "tools": ["process_payment", "create_invoice"]
        },
        {
            "name": "ChittyID Generation",
            "prompt": "Generate a new ChittyID for a legal matter",
            "tools": ["generate_chitty_id", "validate_id"]
        }
    ]

    try:
        client = ChittyOSOpenAIClient()
        print(f"✅ Connected to ChittyMCP: {client.chittymcp_url}")
        print(f"🔐 Using API Key: {client.chitty_api_key[:12]}...")
        print()

        for i, scenario in enumerate(scenarios, 1):
            print(f"📋 Scenario {i}: {scenario['name']}")
            print(f"❓ Prompt: {scenario['prompt']}")
            print(f"🔧 Expected Tools: {', '.join(scenario['tools'])}")
            print("-" * 30)

            # Run the scenario
            result = client.create_response(
                user_input=scenario['prompt'],
                allowed_tools=scenario['tools'],
                require_approval="never"  # Demo mode
            )

            if result["success"]:
                print("✅ SUCCESS")
                print(f"📝 Response: {result['output_text'][:200]}...")

                if result["tool_calls"]:
                    print(f"🔧 Tools Called: {len(result['tool_calls'])}")
                    for call in result["tool_calls"]:
                        if call["type"] == "tool_call":
                            print(f"  - {call['tool_name']}: {call.get('output', 'N/A')[:50]}...")
                else:
                    print("ℹ️  No tools were called")
            else:
                print(f"❌ FAILED: {result['error']}")

            print()

    except Exception as e:
        print(f"💥 Demo failed: {e}")
        print("\n🔧 Troubleshooting:")
        print("1. Ensure OPENAI_API_KEY is set")
        print("2. Ensure CHITTY_API_KEY is set")
        print("3. Verify ChittyMCP server is running at mcp.chitty.cc")
        print("4. Check your network connection")

if __name__ == "__main__":
    main()