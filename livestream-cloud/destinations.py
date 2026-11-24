"""Resolve only operator-approved RTMP ingest hosts; never trust user DNS."""
import ipaddress
import os
import re
import socket
from urllib.parse import urlsplit

class InvalidDestination(ValueError):
    pass

DEFAULT_HOSTS = frozenset({
    'a.rtmps.youtube.com', 'b.rtmps.youtube.com',
    'a.rtmp.youtube.com', 'b.rtmp.youtube.com',
    'live-api-s.facebook.com',
})

def approved_hosts():
    # Custom services require a deployment administrator to approve their
    # exact ingest hostname, not a wildcard or a browser-supplied allowlist.
    extra = os.environ.get('HWP_APPROVED_INGEST_HOSTS', '')
    return DEFAULT_HOSTS | frozenset(x.strip().lower() for x in extra.split(',') if x.strip())

def validate_destination(url, resolve=socket.getaddrinfo, hosts=None):
    if not isinstance(url, str) or not 1 <= len(url) <= 2048 or any(c.isspace() or ord(c)<32 or ord(c)==127 for c in url):
        raise InvalidDestination('Invalid destination.')
    try:
        target = urlsplit(url)
        host = target.hostname
        if target.scheme not in ('rtmp', 'rtmps') or host not in (approved_hosts() if hosts is None else hosts):
            raise InvalidDestination('Ingest host is not approved.')
        if target.username or target.password or target.fragment or '\\' in url:
            raise InvalidDestination('Invalid ingest URL.')
        port = target.port or (443 if target.scheme == 'rtmps' else 1935)
        if port != (443 if target.scheme == 'rtmps' else 1935):
            raise InvalidDestination('Unapproved ingest port.')
        if target.netloc.lower() not in (host, f'{host}:{port}'):
            raise InvalidDestination('Invalid ingest hostname.')
        if not re.fullmatch(r'/[A-Za-z0-9_.~%+/-]+', target.path) or len(target.path.strip('/').split('/')) < 2:
            raise InvalidDestination('A streaming application and key are required.')
        records = resolve(host, port, type=socket.SOCK_STREAM)
        addresses = sorted({entry[4][0] for entry in records})
        if not addresses or any(not ipaddress.ip_address(addr).is_global or ipaddress.ip_address(addr).is_multicast for addr in addresses):
            raise InvalidDestination('Destination must use a public address.')
    except (ValueError, OSError) as exc:
        raise InvalidDestination('Invalid or unreachable destination.') from exc
    return {'url': url, 'host': host, 'addresses': addresses, 'port': port,
            'secure': target.scheme == 'rtmps'}
