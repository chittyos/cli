#!/usr/bin/env python3

import sys
import json
sys.path.append('lib')
from cloudflare_fetcher import CloudflareFetcher

# Fetch all resources
cf = CloudflareFetcher()
resources = cf.get_all_resources()

# Store in Cloudflare KV
import requests

def store_in_kv(namespace_id, data):
    headers = {
        'X-Auth-Email': cf.email,
        'X-Auth-Key': cf.api_key,
        'Content-Type': 'application/json'
    }

    # Store entire registry
    url = f"https://api.cloudflare.com/client/v4/accounts/{cf.account_id}/storage/kv/namespaces/{namespace_id}/values/registry"
    response = requests.put(url, headers=headers, json=data)

    if response.status_code == 200:
        print(f"✓ Stored {sum(len(v) for v in data.values())} resources in KV")
    else:
        print(f"Failed: {response.text}")

# Create KV namespace if needed
url = f"https://api.cloudflare.com/client/v4/accounts/{cf.account_id}/storage/kv/namespaces"
response = requests.post(
    url,
    headers={
        'X-Auth-Email': cf.email,
        'X-Auth-Key': cf.api_key,
        'Content-Type': 'application/json'
    },
    json={'title': 'resource-registry'}
)

if response.status_code == 200:
    namespace_id = response.json()['result']['id']
    print(f"Created KV namespace: {namespace_id}")
else:
    # List existing namespaces
    response = requests.get(url, headers={
        'X-Auth-Email': cf.email,
        'X-Auth-Key': cf.api_key
    })
    namespaces = response.json()['result']
    namespace_id = next((ns['id'] for ns in namespaces if ns['title'] == 'resource-registry'), None)

if namespace_id:
    store_in_kv(namespace_id, resources)
    print(f"Registry available at: https://api.cloudflare.com/client/v4/accounts/{cf.account_id}/storage/kv/namespaces/{namespace_id}/values/registry")
else:
    print("Could not find/create KV namespace")

# Also save locally
with open('registry.json', 'w') as f:
    json.dump(resources, f, indent=2)
    print("✓ Saved to registry.json")