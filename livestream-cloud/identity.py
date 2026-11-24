"""Verify a Firebase identity and the associated live-stream role."""
from access import can_stream

class AccessDenied(Exception):
    pass

def authorize_stream(id_token, verify_token, get_profile):
    if not isinstance(id_token, str) or not id_token or len(id_token) > 16384:
        raise AccessDenied('Sign in to stream.')
    try:
        claims = verify_token(id_token, check_revoked=True)
        uid = claims.get('uid')
        if not isinstance(uid, str) or not uid or '/' in uid:
            raise AccessDenied('Invalid account.')
        profile = get_profile(uid)
    except AccessDenied:
        raise
    except Exception as exc:
        raise AccessDenied('Unable to verify this account.') from exc
    if not can_stream(profile, claims.get('email_verified') is True):
        raise AccessDenied('This account cannot stream.')
    return uid
