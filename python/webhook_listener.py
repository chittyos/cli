#!/usr/bin/env python3

from flask import Flask, request, jsonify
import hmac
import hashlib
import json
import os
import sys
from datetime import datetime
import subprocess
import threading

sys.path.append(os.path.join(os.path.dirname(__file__), 'lib'))
from cloudflare_fetcher import CloudflareFetcher
from registry_updater import RegistryUpdater

app = Flask(__name__)

WEBHOOK_SECRET = os.getenv('CLOUDFLARE_WEBHOOK_SECRET', 'your-webhook-secret')
REGISTRY_API_KEY = os.getenv('REGISTRY_API_KEY', '')

def verify_signature(payload, signature):
    expected_signature = hmac.new(
        WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected_signature, signature)

def handle_resource_update(resource_type, resource_data, action):
    """Handle resource updates in a separate thread"""
    try:
        registry = RegistryUpdater(api_key=REGISTRY_API_KEY)

        if action == 'delete':
            result = registry.delete_resource(resource_data.get('id'))
        elif action in ['create', 'update']:
            resource_data['resource_type'] = resource_type
            result = registry.register_resource(resource_data)
        else:
            print(f"Unknown action: {action}")
            return

        print(f"[{datetime.now().isoformat()}] {action.upper()} {resource_type}: {resource_data.get('name', resource_data.get('id'))}")

        with open('webhook_events.log', 'a') as log:
            log.write(json.dumps({
                'timestamp': datetime.now().isoformat(),
                'action': action,
                'resource_type': resource_type,
                'resource_id': resource_data.get('id'),
                'result': result
            }) + '\n')

    except Exception as e:
        print(f"Error handling resource update: {e}")

@app.route('/webhook/cloudflare', methods=['POST'])
def cloudflare_webhook():
    signature = request.headers.get('X-Signature-256', '')
    payload = request.get_data()

    if not verify_signature(payload, signature):
        return jsonify({'error': 'Invalid signature'}), 403

    try:
        data = json.loads(payload)
        event_type = data.get('event', {}).get('type', '')
        resource_data = data.get('data', {})

        event_mapping = {
            'zone.created': ('domain', 'create'),
            'zone.updated': ('domain', 'update'),
            'zone.deleted': ('domain', 'delete'),
            'worker.deployed': ('worker', 'update'),
            'worker.deleted': ('worker', 'delete'),
            'pages.project.created': ('pages', 'create'),
            'pages.deployment.started': ('pages', 'update'),
            'pages.project.deleted': ('pages', 'delete'),
        }

        if event_type in event_mapping:
            resource_type, action = event_mapping[event_type]

            thread = threading.Thread(
                target=handle_resource_update,
                args=(resource_type, resource_data, action)
            )
            thread.daemon = True
            thread.start()

            return jsonify({
                'status': 'accepted',
                'event': event_type,
                'resource_type': resource_type,
                'action': action
            }), 202

        else:
            print(f"Unhandled event type: {event_type}")
            return jsonify({
                'status': 'ignored',
                'event': event_type
            }), 200

    except Exception as e:
        print(f"Error processing webhook: {e}")
        return jsonify({'error': 'Processing failed'}), 500

@app.route('/webhook/manual-sync/<resource_type>', methods=['POST'])
def manual_sync(resource_type):
    """Manual trigger for syncing specific resource types"""
    api_key = request.headers.get('X-API-Key', '')

    if api_key != REGISTRY_API_KEY:
        return jsonify({'error': 'Unauthorized'}), 401

    valid_types = ['domains', 'workers', 'pages', 'all']
    if resource_type not in valid_types:
        return jsonify({'error': f'Invalid resource type. Must be one of: {valid_types}'}), 400

    def run_sync():
        if resource_type == 'all':
            subprocess.run([sys.executable, 'sync_all.py'])
        else:
            hook_name = f"sync_{resource_type}"
            subprocess.run([sys.executable, f'hooks/{hook_name}.py'])

    thread = threading.Thread(target=run_sync)
    thread.daemon = True
    thread.start()

    return jsonify({
        'status': 'sync_started',
        'resource_type': resource_type,
        'timestamp': datetime.now().isoformat()
    }), 202

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'service': 'cloudflare-registry-sync',
        'timestamp': datetime.now().isoformat()
    }), 200

@app.route('/status', methods=['GET'])
def status():
    try:
        with open('full_sync_snapshot.json', 'r') as f:
            last_sync = json.load(f)

        return jsonify({
            'status': 'operational',
            'last_sync': last_sync.get('timestamp'),
            'resources_synced': last_sync.get('summary', {}).get('total', 0),
            'errors': last_sync.get('summary', {}).get('errors', {})
        }), 200

    except FileNotFoundError:
        return jsonify({
            'status': 'operational',
            'last_sync': None,
            'message': 'No sync has been performed yet'
        }), 200

if __name__ == '__main__':
    port = int(os.getenv('WEBHOOK_PORT', 8080))
    print(f"Starting webhook listener on port {port}")
    print(f"Webhook endpoint: http://localhost:{port}/webhook/cloudflare")
    print(f"Manual sync endpoint: http://localhost:{port}/webhook/manual-sync/<resource_type>")
    print(f"Health check: http://localhost:{port}/health")

    app.run(host='0.0.0.0', port=port, debug=False)