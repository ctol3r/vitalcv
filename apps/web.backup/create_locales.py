import os
import json

langs = ['en-US', 'en-GB', 'fr-CA', 'hi-IN', 'es-MX', 'de-DE']
files = ['dashboard', 'onboarding', 'verification', 'timeline', 'errors']

base_path = 'apps/web/i18n/locales'

content = {
    'dashboard': {"welcome": "Welcome back", "stats": "Statistics", "credentials": "Your Credentials"},
    'onboarding': {"title": "Get Started", "step1": "Personal Info", "next": "Next", "back": "Back"},
    'verification': {"verify": "Verify Identity", "status": "Status", "pending": "Pending Verification", "approved": "Approved"},
    'timeline': {"title": "Credential Timeline", "date": "Date", "event": "Event", "issued": "Issued"},
    'errors': {"generic": "Something went wrong", "network": "Network error", "unauthorized": "Unauthorized access"}
}

for lang in langs:
    lang_path = os.path.join(base_path, lang)
    os.makedirs(lang_path, exist_ok=True)
    for f in files:
        with open(os.path.join(lang_path, f'{f}.json'), 'w') as json_file:
            json.dump(content[f], json_file, indent=2)














