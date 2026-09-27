"""Update the offline HTML bundle from the readable application sources."""
import base64
import gzip
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
bundle = ROOT / 'SQL Spielplatz.html'
html = bundle.read_bytes().decode('utf-8')
pattern = r'(<script type="__bundler/manifest">\s*)(.*?)(\s*</script>)'
match = re.search(pattern, html, re.S)
manifest = json.loads(match[2])
mapping = json.loads((ROOT / 'src/bundle-map.json').read_text())
for name, uid in mapping.items():
    data = (ROOT / 'src' / name).read_bytes()
    manifest[uid]['data'] = base64.b64encode(gzip.compress(data, mtime=0)).decode()
    manifest[uid]['compressed'] = True
html = html[:match.start(2)] + json.dumps(manifest, separators=(',', ':')) + html[match.end(2):]
# Keep the workspace stylesheet readable while embedding it in the offline template.
template_pattern = r'(<script type="__bundler/template">\s*)(.*?)(\s*</script>)'
template_match = re.search(template_pattern, html, re.S)
template = json.loads(template_match[2])
template = re.sub(r'\n?<style id="workspace-styles">.*?</style>', '', template, flags=re.S)
css = (ROOT / 'src/schema.css').read_text(encoding='utf-8')
template = template.replace('</head>', '<style id="workspace-styles">' + css + '</style></head>')
encoded_template = json.dumps(template, ensure_ascii=False).replace('</', '<\\u002F')
html = html[:template_match.start(2)] + encoded_template + html[template_match.end(2):]
bundle.write_bytes(html.encode('utf-8'))
print('Offline-Bundle aktualisiert.')
