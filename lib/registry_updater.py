#!/usr/bin/env python3

import json
import requests
from typing import Dict, List, Any, Optional
from datetime import datetime
import hashlib
import hmac

class RegistryUpdater:
    def __init__(self, api_url: str = "https://chitty.cc/registry", api_key: str = None):
        self.api_url = api_url.rstrip('/')
        self.api_key = api_key
        self.session = requests.Session()

        if self.api_key:
            self.session.headers.update({
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            })

    def _generate_signature(self, payload: str, secret: str) -> str:
        return hmac.new(
            secret.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()

    def register_resource(self, resource: Dict[str, Any]) -> Dict[str, Any]:
        endpoint = f"{self.api_url}/api/resources"

        payload = {
            'id': resource.get('id'),
            'name': resource.get('name'),
            'type': resource.get('resource_type'),
            'provider': 'cloudflare',
            'metadata': {
                'status': resource.get('status'),
                'created_on': resource.get('created_on'),
                'modified_on': resource.get('modified_on'),
                'details': resource
            },
            'timestamp': datetime.utcnow().isoformat()
        }

        try:
            response = self.session.post(endpoint, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {
                'success': False,
                'error': str(e),
                'resource': resource.get('name')
            }

    def update_resource(self, resource_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        endpoint = f"{self.api_url}/api/resources/{resource_id}"

        payload = {
            'updates': updates,
            'timestamp': datetime.utcnow().isoformat()
        }

        try:
            response = self.session.patch(endpoint, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {
                'success': False,
                'error': str(e),
                'resource_id': resource_id
            }

    def delete_resource(self, resource_id: str) -> Dict[str, Any]:
        endpoint = f"{self.api_url}/api/resources/{resource_id}"

        try:
            response = self.session.delete(endpoint)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {
                'success': False,
                'error': str(e),
                'resource_id': resource_id
            }

    def bulk_register(self, resources: List[Dict[str, Any]]) -> Dict[str, Any]:
        endpoint = f"{self.api_url}/api/resources/bulk"

        payload = {
            'resources': [
                {
                    'id': r.get('id'),
                    'name': r.get('name'),
                    'type': r.get('resource_type'),
                    'provider': 'cloudflare',
                    'metadata': {
                        'status': r.get('status'),
                        'created_on': r.get('created_on'),
                        'modified_on': r.get('modified_on'),
                        'details': r
                    }
                } for r in resources
            ],
            'timestamp': datetime.utcnow().isoformat()
        }

        try:
            response = self.session.post(endpoint, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {
                'success': False,
                'error': str(e),
                'count': len(resources)
            }

    def sync_resources(self, resource_type: str, resources: List[Dict[str, Any]]) -> Dict[str, Any]:
        endpoint = f"{self.api_url}/api/sync/{resource_type}"

        payload = {
            'provider': 'cloudflare',
            'resources': resources,
            'sync_mode': 'full',
            'timestamp': datetime.utcnow().isoformat()
        }

        try:
            response = self.session.post(endpoint, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {
                'success': False,
                'error': str(e),
                'resource_type': resource_type,
                'count': len(resources)
            }

    def get_registered_resources(self, resource_type: str = None) -> List[Dict[str, Any]]:
        endpoint = f"{self.api_url}/api/resources"

        params = {'provider': 'cloudflare'}
        if resource_type:
            params['type'] = resource_type

        try:
            response = self.session.get(endpoint, params=params)
            response.raise_for_status()
            return response.json().get('resources', [])
        except requests.exceptions.RequestException as e:
            print(f"Error fetching registered resources: {e}")
            return []

    def health_check(self) -> bool:
        try:
            response = self.session.get(f"{self.api_url}/health")
            return response.status_code == 200
        except:
            return False