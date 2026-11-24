"""Validate outbound streaming targets before allocating an encoder."""
import ipaddress
import socket
from urllib.parse import urlsplit

class InvalidDestination(ValueError):
    pass

def validate_destination(url, resolve=socket.getaddrinfo):
    if not isinstance(url,str) or len(url)>2048 or any(ord(c)<32 for c in url):
        raise InvalidDestination('Invalid destination.')
    try:
        target=urlsplit(url)
        if target.scheme not in ('rtmp','rtmps') or not target.hostname or target.username or target.password or not target.path.strip('/'):
            raise InvalidDestination('A streaming server and key are required.')
        port=target.port or (443 if target.scheme=='rtmps' else 1935)
        records=resolve(target.hostname,port,type=socket.SOCK_STREAM)
        addresses={entry[4][0] for entry in records}
        if not addresses or any(not ipaddress.ip_address(addr).is_global for addr in addresses):
            raise InvalidDestination('Destination must use a public address.')
    except (ValueError, OSError) as exc:
        raise InvalidDestination('Invalid or unreachable destination.') from exc
    return {'url':url,'addresses':addresses,'port':port}
