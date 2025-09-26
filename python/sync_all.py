#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'lib'))

from cloudflare_fetcher import CloudflareFetcher
from registry_updater import RegistryUpdater
import json
from datetime import datetime
import subprocess
import argparse

def run_hook(hook_name):
    hook_path = f"./hooks/{hook_name}.py"
    try:
        result = subprocess.run([sys.executable, hook_path], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✓ {hook_name} completed successfully")
            if result.stdout:
                print(result.stdout)
        else:
            print(f"✗ {hook_name} failed with code {result.returncode}")
            if result.stderr:
                print(result.stderr)
        return result.returncode
    except Exception as e:
        print(f"✗ Failed to run {hook_name}: {e}")
        return 1

def sync_all_resources(resource_types=None):
    print(f"\n{'='*60}")
    print(f"Cloudflare → Registry.chitty.cc Sync")
    print(f"Started at: {datetime.now().isoformat()}")
    print(f"{'='*60}\n")

    cf = CloudflareFetcher()
    registry = RegistryUpdater()

    if not registry.health_check():
        print("⚠ Registry health check failed, continuing anyway...")

    all_resources = cf.get_all_resources()

    summary = {
        'timestamp': datetime.now().isoformat(),
        'synced': {},
        'errors': {},
        'total': 0
    }

    available_types = {
        'domains': 'domain',
        'workers': 'worker',
        'pages': 'pages',
        'r2_buckets': 'r2_bucket',
        'kv_namespaces': 'kv_namespace',
        'durable_objects': 'durable_object'
    }

    types_to_sync = resource_types if resource_types else available_types.keys()

    for resource_key in types_to_sync:
        if resource_key not in available_types:
            print(f"⚠ Unknown resource type: {resource_key}")
            continue

        resource_type = available_types[resource_key]
        resources = all_resources.get(resource_key, [])

        if not resources:
            print(f"→ No {resource_key} found to sync")
            continue

        print(f"\n→ Syncing {len(resources)} {resource_key}...")

        try:
            result = registry.sync_resources(resource_type, resources)

            if result.get('success', False):
                print(f"  ✓ Successfully synced {len(resources)} {resource_key}")
                summary['synced'][resource_key] = len(resources)
            else:
                print(f"  ✗ Failed to sync {resource_key}: {result.get('error')}")
                summary['errors'][resource_key] = result.get('error')

        except Exception as e:
            print(f"  ✗ Error syncing {resource_key}: {e}")
            summary['errors'][resource_key] = str(e)

    summary['total'] = sum(summary['synced'].values())

    with open('sync_all.log', 'a') as log:
        log.write(json.dumps(summary, indent=2) + '\n')

    with open('full_sync_snapshot.json', 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'resources': all_resources,
            'summary': summary
        }, f, indent=2)

    print(f"\n{'='*60}")
    print(f"Sync Complete!")
    print(f"✓ Synced: {summary['total']} total resources")
    for resource_type, count in summary['synced'].items():
        print(f"  • {resource_type}: {count}")

    if summary['errors']:
        print(f"\n✗ Errors encountered:")
        for resource_type, error in summary['errors'].items():
            print(f"  • {resource_type}: {error}")

    print(f"\nFinished at: {datetime.now().isoformat()}")
    print(f"{'='*60}\n")

    return 0 if not summary['errors'] else 1

def main():
    parser = argparse.ArgumentParser(description='Sync Cloudflare resources to registry.chitty.cc')
    parser.add_argument(
        '--type',
        nargs='+',
        choices=['domains', 'workers', 'pages', 'r2_buckets', 'kv_namespaces', 'durable_objects', 'all'],
        help='Resource types to sync (default: all)'
    )
    parser.add_argument(
        '--hooks',
        action='store_true',
        help='Run individual hooks instead of bulk sync'
    )

    args = parser.parse_args()

    if args.hooks:
        hooks = []
        if not args.type or 'all' in args.type:
            hooks = ['sync_domains', 'sync_workers', 'sync_pages']
        else:
            if 'domains' in args.type:
                hooks.append('sync_domains')
            if 'workers' in args.type:
                hooks.append('sync_workers')
            if 'pages' in args.type:
                hooks.append('sync_pages')

        exit_code = 0
        for hook in hooks:
            result = run_hook(hook)
            if result != 0:
                exit_code = result

        return exit_code

    else:
        resource_types = None if not args.type or 'all' in args.type else args.type
        return sync_all_resources(resource_types)

if __name__ == "__main__":
    exit(main())