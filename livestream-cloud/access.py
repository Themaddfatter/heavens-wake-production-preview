"""Authorization policy for the independently hosted livestream relay."""
ALLOWED_MINISTRIES = frozenset({'audio-video-team', 'audio-video', 'audio-video-ministry', 'ministerial', 'ministerial-team', 'ministerial-ministry', 'preaching', 'preaching-team', 'pastoral', 'pastoral-team'})

def can_stream(profile, email_verified):
    if not isinstance(profile, dict) or profile.get('active') is not True:
        return False
    if profile.get('emailVerificationRequired') is True and email_verified is not True:
        return False
    if profile.get('role') in ('admin', 'super_admin'):
        return True
    memberships = []
    for field in ('ministries', 'memberMinistries'):
        value = profile.get(field)
        if isinstance(value, list):
            memberships.extend(value)
    return any(isinstance(item, str) and item in ALLOWED_MINISTRIES for item in memberships)
