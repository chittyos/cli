#!/usr/bin/env python3

import os
import subprocess
import json
import requests
from typing import List, Dict, Any, Optional
from datetime import datetime

class CloudflareFetcher:
    def __init__(self, api_key: str = None, email: str = None, account_id: str = None):
        self.api_key = api_key or self._get_secret("op://Claude-Code Tools/Cloudflare API KEYS/global_api_key")
        self.email = email or self._get_secret("op://Claude-Code Tools/Cloudflare API KEYS/email")
        self.account_id = account_id or self._get_secret("op://Claude-Code Tools/Cloudflare API KEYS/account id")

        self.headers = {
            'X-Auth-Email': self.email,
            'X-Auth-Key': self.api_key,
            'Content-Type': 'application/json'
        }
        self.base_url = "https://api.cloudflare.com/client/v4"

    def _get_secret(self, reference: str) -> str:
        try:
            result = subprocess.run(
                ['op', 'read', reference],
                capture_output=True,
                text=True,
                check=True
            )
            return result.stdout.strip()
        except subprocess.CalledProcessError:
            return os.getenv(reference.split('/')[-1].upper().replace(' ', '_'), '')

    def _paginated_fetch(self, endpoint: str, params: Dict = None) -> List[Dict]:
        all_results = []
        page = 1
        per_page = 50

        while True:
            request_params = {'page': page, 'per_page': per_page}
            if params:
                request_params.update(params)

            response = requests.get(
                f"{self.base_url}/{endpoint}",
                headers=self.headers,
                params=request_params
            )

            if response.status_code != 200:
                raise Exception(f"API error: {response.status_code} - {response.text}")

            data = response.json()
            if not data['success']:
                raise Exception(f"API request failed: {data.get('errors', 'Unknown error')}")

            all_results.extend(data['result'])

            result_info = data.get('result_info', {})
            if page * per_page >= result_info.get('total_count', 0):
                break

            page += 1

        return all_results

    def get_domains(self) -> List[Dict]:
        params = {
            'account.id': self.account_id,
            'status': 'active,pending,initializing,moved'
        }
        zones = self._paginated_fetch('zones', params)

        return [{
            'id': zone['id'],
            'name': zone['name'],
            'status': zone['status'],
            'type': zone['type'],
            'name_servers': zone.get('name_servers', []),
            'created_on': zone['created_on'],
            'modified_on': zone['modified_on'],
            'plan': zone.get('plan', {}).get('name', 'free'),
            'resource_type': 'domain'
        } for zone in zones]

    def get_workers(self) -> List[Dict]:
        endpoint = f"accounts/{self.account_id}/workers/scripts"
        scripts = self._paginated_fetch(endpoint)

        workers = []
        for script in scripts:
            detail_response = requests.get(
                f"{self.base_url}/accounts/{self.account_id}/workers/scripts/{script['id']}",
                headers=self.headers
            )

            if detail_response.status_code == 200:
                detail_data = detail_response.json()
                if detail_data['success']:
                    script_detail = detail_data['result']
                    workers.append({
                        'id': script['id'],
                        'name': script['id'],
                        'created_on': script.get('created_on', ''),
                        'modified_on': script.get('modified_on', ''),
                        'usage_model': script.get('usage_model', 'bundled'),
                        'routes': script_detail.get('routes', []),
                        'handlers': script_detail.get('handlers', []),
                        'resource_type': 'worker'
                    })

        return workers

    def get_pages(self) -> List[Dict]:
        endpoint = f"accounts/{self.account_id}/pages/projects"
        projects = self._paginated_fetch(endpoint)

        return [{
            'id': project['id'],
            'name': project['name'],
            'subdomain': project.get('subdomain', ''),
            'domains': project.get('domains', []),
            'created_on': project.get('created_on', ''),
            'modified_on': project.get('production_deployments', {}).get('latest_deployment', {}).get('created_on', ''),
            'source': project.get('source', {}),
            'build_config': project.get('build_config', {}),
            'deployment_configs': project.get('deployment_configs', {}),
            'latest_deployment': project.get('production_deployments', {}).get('latest_deployment', {}),
            'resource_type': 'pages'
        } for project in projects]

    def get_r2_buckets(self) -> List[Dict]:
        endpoint = f"accounts/{self.account_id}/r2/buckets"
        response = requests.get(
            f"{self.base_url}/{endpoint}",
            headers=self.headers
        )

        if response.status_code != 200:
            return []

        data = response.json()
        if not data.get('success'):
            return []

        return [{
            'id': bucket['name'],
            'name': bucket['name'],
            'created_on': bucket.get('creation_date', ''),
            'location': bucket.get('location', {}).get('name', 'auto'),
            'resource_type': 'r2_bucket'
        } for bucket in data.get('result', {}).get('buckets', [])]

    def get_kv_namespaces(self) -> List[Dict]:
        endpoint = f"accounts/{self.account_id}/storage/kv/namespaces"
        namespaces = self._paginated_fetch(endpoint)

        return [{
            'id': ns['id'],
            'name': ns['title'],
            'created_on': ns.get('created_on', ''),
            'modified_on': ns.get('modified_on', ''),
            'resource_type': 'kv_namespace'
        } for ns in namespaces]

    def get_durable_objects(self) -> List[Dict]:
        endpoint = f"accounts/{self.account_id}/workers/durable_objects/namespaces"
        namespaces = self._paginated_fetch(endpoint)

        return [{
            'id': ns['id'],
            'name': ns['name'],
            'script': ns.get('script', ''),
            'class': ns.get('class', ''),
            'created_on': ns.get('created_on', ''),
            'modified_on': ns.get('modified_on', ''),
            'resource_type': 'durable_object'
        } for ns in namespaces]

    def get_all_resources(self) -> Dict[str, List[Dict]]:
        resources = {
            'domains': [],
            'workers': [],
            'pages': [],
            'r2_buckets': [],
            'kv_namespaces': [],
            'durable_objects': []
        }

        try:
            resources['domains'] = self.get_domains()
        except Exception as e:
            print(f"Error fetching domains: {e}")

        try:
            resources['workers'] = self.get_workers()
        except Exception as e:
            print(f"Error fetching workers: {e}")

        try:
            resources['pages'] = self.get_pages()
        except Exception as e:
            print(f"Error fetching pages: {e}")

        try:
            resources['r2_buckets'] = self.get_r2_buckets()
        except Exception as e:
            print(f"Error fetching R2 buckets: {e}")

        try:
            resources['kv_namespaces'] = self.get_kv_namespaces()
        except Exception as e:
            print(f"Error fetching KV namespaces: {e}")

        try:
            resources['durable_objects'] = self.get_durable_objects()
        except Exception as e:
            print(f"Error fetching Durable Objects: {e}")

        return resources