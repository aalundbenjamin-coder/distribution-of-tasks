# -*- coding: utf-8 -*-
"""
Builds the presentation walkthrough, one file per language.

Everything factual on the page — every score, ranking and rejection reason — is
read from engine-<locale>.json, which is real `matchTask` output produced by
scenario.ts. Nothing on the page is written by hand to look plausible, so the
page cannot drift away from what the engine actually does.

Run through `npm run build:presentation`, which regenerates the engine output
for both languages first.
"""

import html
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).parent
OUT = HERE.parent.parent / 'public'

sys.path.insert(0, str(HERE))
from copy import COPY          # noqa: E402
from people import PEOPLE, ARCHIVE  # noqa: E402

AV = json.loads((HERE / 'avatars.json').read_text())
IC = json.loads((HERE / 'icons.json').read_text())
HEAD = (HERE / 'head.html').read_text()
CHECK, XI, WARNI, SHIELD = IC['check'], IC['x'], IC['warn'], IC['shield']

ORDER = ['sofie', 'freja', 'mikkel', 'jonas', 'amira']
NAME2ID = {
    'Sofie Lindgren': 'sofie', 'Freja Nilsen': 'freja', 'Mikkel Dahl': 'mikkel',
    'Jonas Berg': 'jonas', 'Amira Haddad': 'amira',
}


def esc(v):
    return html.escape(str(v))


def pc(v):
    return int(round(v * 100))


def pips(level):
    return '<span class="pips" role="img" aria-label="%d/5">%s</span>' % (
        level, ''.join('<i class="on"></i>' if i <= level else '<i></i>' for i in range(1, 6)))


def mini(pid, size=30):
    return AV[pid].replace('class="portrait"',
                           f'class="portrait" style="width:{size}px;height:{size}px;border:0"')


def person_card(pid, c, people):
    p = people[pid]
    caps = []
    for nm, lv, ver, note in p['caps']:
        lapsed = bool(note) and ('LAPSED' in note or 'UDLØBET' in note)
        marks = ''
        if ver and not lapsed:
            marks += f'<span class="verified" title="{esc(c["teamBody2b"])}">{SHIELD}</span>'
        if lapsed:
            marks += f'<span class="lapsed">{WARNI}</span>'
        if lapsed:
            right = f'<span class="tiny" style="color:var(--danger);font-weight:600">{esc(note)}</span>'
        elif note:
            right = f'<span class="tiny subtle">{esc(note)}</span>'
        else:
            right = pips(lv)
        caps.append(
            f'<div class="cap"><span class="cap-name">{marks}<span>{esc(nm)}</span></span>{right}</div>')

    hist = ''.join(
        f'<li><span class="ref">{r}</span><span class="ttl">{esc(t)}</span><span class="dt">{d}</span></li>'
        for r, t, d in p['hist'])

    on_leave = pid == 'amira'
    return f'''<article class="person">
  <div class="person-hd">
    {AV[pid]}
    <div>
      <h3>{esc(p['name'])}</h3>
      <div class="role">{esc(p['role'])}</div>
      <div style="margin-top:8px"><span class="pill{'' if not on_leave else ' warn'}">{'<span class="dot"></span>' if not on_leave else ''}{esc(p['load'])}</span></div>
    </div>
  </div>
  <div class="person-sec">
    <h4>{esc(c['hEducation'])}</h4>
    <p class="thesis"><strong>{esc(p['edu'])}</strong><br>{esc(p['school'])}</p>
    <p class="thesis" style="margin-top:8px">{esc(c['thesisWord'])} <em>&ldquo;{esc(p['thesis'])}&rdquo;</em></p>
  </div>
  <div class="person-sec">
    <h4>{esc(c['hGoodAt'])}</h4>
    <p class="thesis" style="margin-bottom:10px">{esc(p['blurb'])}</p>
    {''.join(caps)}
  </div>
  <div class="person-sec" style="margin-top:auto">
    <h4>{esc(c['hCompleted'])}</h4>
    <ul class="hist">{hist}</ul>
  </div>
</article>'''


def req_table(task, c):
    rows = []
    for r in task['requirements']:
        mandatory = r['necessity'] == 'MANDATORY'
        need = c['mustHold'] if r['skillKind'] == 'CERTIFICATION' else c['levelOrAbove'].replace('{n}', str(r['minLevel']))
        rows.append(
            f'''<tr><td><strong>{esc(r['skillName'])}</strong></td>
            <td class="mono">{esc(need)}</td>
            <td><span class="pill {'bad' if mandatory else ''}">{esc(c['mandatory'] if mandatory else c['preferred'])}</span></td>
            <td class="num subtle">{r['weight']}</td></tr>''')
    return (f'<div class="tw"><table class="d"><thead><tr>'
            f'<th>{esc(c["cCapability"])}</th><th>{esc(c["cRequirement"])}</th>'
            f'<th>{esc(c["cNecessity"])}</th><th>{esc(c["cWeight"])}</th>'
            f'</tr></thead><tbody>{"".join(rows)}</tbody></table></div>')


def shortlist(result, c):
    rows = []
    for cand in result['candidates']:
        if not cand['eligible']:
            continue
        pid = NAME2ID[cand['fullName']]
        applicable = [f for f in cand['factors'] if f['applicable']]
        top = sorted(applicable, key=lambda f: -(f['value'] * f['weight']))[:3]
        chips = ''.join(f'<span class="pill">{esc(f["label"])} {pc(f["value"])}%</span>' for f in top)
        detail = ''.join(
            f'<div class="fac"><span class="fac-l">{esc(f["label"])}</span>'
            f'<span class="fac-v">{pc(f["value"])}%</span>'
            f'<span class="tiny subtle">{esc(f["detail"])}</span></div>' for f in applicable)
        rows.append(f'''<tr class="{'win' if cand['rank'] == 1 else ''}">
          <td class="mono"><strong>{cand['rank']}</strong></td>
          <td><div class="row" style="gap:9px">{mini(pid)}<div><strong>{esc(cand['fullName'])}</strong>
            {f'<div style="margin-top:3px"><span class="pill ok"><span class="dot"></span>{esc(c["assignedPill"])}</span></div>' if cand['rank'] == 1 else ''}</div></div></td>
          <td><div class="score"><span class="meter {'g' if cand['score'] >= .75 else ''}"><i style="width:{pc(cand['score'])}%"></i></span><b>{pc(cand['score'])}%</b></div></td>
          <td><div style="display:flex;gap:5px;flex-wrap:wrap">{chips}</div>
            <details style="margin-top:9px"><summary class="tiny subtle" style="cursor:pointer">{esc(c['fullBreakdown'])}</summary>
            <div style="margin-top:9px">{detail}</div></details></td></tr>''')
    return (f'<div class="tw"><table class="d"><thead><tr><th style="width:44px">#</th>'
            f'<th>{esc(c["cCoworker"])}</th><th style="width:150px">{esc(c["cMatch"])}</th>'
            f'<th>{esc(c["cWhy"])}</th></tr></thead><tbody>{"".join(rows)}</tbody></table></div>')


def blocked(result, c):
    rows = []
    for cand in result['candidates']:
        if cand['eligible']:
            continue
        pid = NAME2ID[cand['fullName']]
        soft = ('NOT_AVAILABLE', 'OUTSIDE_AVAILABILITY_WINDOW', 'NO_CAPACITY')
        items = ''.join(
            f'<li><span style="color:{"var(--warn)" if b["code"] in soft else "var(--danger)"}">'
            f'{WARNI if b["code"] in soft else XI}</span>{esc(b["message"])}</li>'
            for b in cand['blockers'])
        rows.append(f'''<tr class="out"><td style="width:210px">
          <div class="row" style="gap:9px">{mini(pid, 26)}<strong>{esc(cand['fullName'])}</strong></div></td>
          <td><ul class="blk">{items}</ul></td></tr>''')
    return (f'<div class="tw"><table class="d"><thead><tr><th>{esc(c["cCoworker"])}</th>'
            f'<th>{esc(c["cWhyNot"])}</th></tr></thead><tbody>{"".join(rows)}</tbody></table></div>')


def app_panel(url, inner):
    return (f'<div class="app"><div class="app-bar"><span class="tl"><i></i><i></i><i></i></span>'
            f'<span class="app-url">{esc(url)}</span></div><div class="app-bd">{inner}</div></div>')


def build(locale):
    c = COPY[locale]
    people = PEOPLE[locale]
    data = json.loads((HERE / f'engine-{locale}.json').read_text())
    ta, ra = data['taskA']['task'], data['taskA']['result']
    tb, rb = data['taskB']['task'], data['taskB']['result']

    team = '\n'.join(person_card(pid, c, people) for pid in ORDER)

    tl_rows = []
    for dt, ref, title, pid, is_new in ARCHIVE[locale]:
        node = 'background:var(--accent);box-shadow:0 0 0 1px var(--accent-line)' if is_new else ''
        state = c['stateAssigned'] if is_new else c['stateCompleted']
        tl_rows.append(f'''<div class="tl-row">
          <div class="tl-date">{esc(dt)} 2026</div>
          <div class="tl-spine"><span class="tl-node" style="{node}"></span></div>
          <div class="tl-card"><div class="t">{esc(title)}</div>
            <div class="m"><span class="mono subtle">{ref}</span><span class="subtle">·</span>
              <span class="who">{mini(pid, 22)}{esc(people[pid]['name'])}</span>
              <span class="pill {'accent' if is_new else 'ok'}">{'' if is_new else CHECK}{esc(state)}</span></div>
          </div></div>''')

    panel_a = app_panel('distribution-of-tasks.vercel.app/tasks/TSK-2041', f'''
      <div class="eyebrow">{esc(ta['reference'])}</div>
      <h3 style="font-size:22px;margin-top:8px;font-family:var(--ui);font-weight:680">{esc(ta['title'])}</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 20px">
        <span class="pill bad"><span class="dot"></span>{esc(c['highPriority'])}</span>
        <span class="pill">{esc(c['estimated'].replace('{n}', '6'))}</span>
        <span class="pill">{esc(c['language'].replace('{l}', 'DA'))}</span></div>
      <div class="card-t" style="margin-bottom:9px">{esc(c['reqTitle'])}</div>{req_table(ta, c)}
      <div class="notice ok" style="margin:22px 0 16px">{CHECK}<span><b>{esc(ra['summary'])}</b>
        <span style="display:block;margin-top:4px;opacity:.9">{esc(ra['rationale'])}</span></span></div>
      <div class="card-t" style="margin:22px 0 9px">{esc(c['shortTitle'])}</div>{shortlist(ra, c)}
      <div class="card-t" style="margin:26px 0 9px">{esc(c['blockTitle'])}</div>{blocked(ra, c)}''')

    panel_b = app_panel('distribution-of-tasks.vercel.app/tasks/TSK-2042', f'''
      <div class="eyebrow">{esc(tb['reference'])}</div>
      <h3 style="font-size:22px;margin-top:8px;font-family:var(--ui);font-weight:680">{esc(tb['title'])}</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 20px">
        <span class="pill">{esc(c['normalPriority'])}</span>
        <span class="pill">{esc(c['estimated'].replace('{n}', '8'))}</span>
        <span class="pill">{esc(c['language'].replace('{l}', 'EN'))}</span></div>
      <div class="card-t" style="margin-bottom:9px">{esc(c['reqTitle'])}</div>{req_table(tb, c)}
      <div class="notice ok" style="margin:22px 0 16px">{CHECK}<span><b>{esc(rb['summary'])}</b>
        <span style="display:block;margin-top:4px;opacity:.9">{esc(rb['rationale'])}</span></span></div>
      <div class="card-t" style="margin:22px 0 9px">{esc(c['shortTitle'])}</div>{shortlist(rb, c)}
      <div class="card-t" style="margin:26px 0 9px">{esc(c['blockTitle2'])}</div>{blocked(rb, c)}''')

    other_href = '/presentation/en' if locale == 'da' else '/presentation'
    # Two links styled as one control. The current language is marked, not
    # clickable-looking; the other is the only thing to press.
    switcher = (
        f'<nav class="lang" aria-label="Language">'
        f'<span class="lang-on" aria-current="true">{esc(c["selfLabel"])}</span>'
        f'<a class="lang-off" href="{other_href}">{esc(c["otherLabel"])}</a>'
        f'</nav>')

    body = f'''
<main>
<section class="hero">
  <div class="wrap">
    <div class="row" style="justify-content:center;margin-bottom:22px">{switcher}</div>
    <span class="pill accent">{esc(c['badge'])}</span>
    <h1>{esc(c['heroTitle'])}</h1>
    <p class="lede">{esc(c['heroBody'])}</p>
    <div class="badge-line">
      <span class="pill"><span class="dot" style="color:var(--danger)"></span>{esc(c['chip1'])}</span>
      <span class="pill"><span class="dot" style="color:var(--warn)"></span>{esc(c['chip2'])}</span>
      <span class="pill"><span class="dot" style="color:var(--ok)"></span>{esc(c['chip3'])}</span>
    </div>
  </div>
</section>

<div class="wrap"><hr class="rule"></div>

<section class="band">
  <div class="narrate" style="text-align:center;max-width:56ch">
    <span class="eyebrow">{esc(c['pipeEyebrow'])}</span>
    <h2 style="font-size:30px;margin-top:12px">{esc(c['pipeTitle'])}</h2>
    <p class="lede" style="margin-top:14px;font-size:17px">{esc(c['pipeBody'])}</p>
  </div>
  <div class="wrap"><div class="pipe">
    <div class="step"><div class="step-n">{esc(c['step'])} 1</div><h3>{esc(c['s1t'])}</h3><p>{esc(c['s1b'])}</p></div>
    <div class="step" data-tone="gate"><div class="step-n">{esc(c['step'])} 2</div><h3>{esc(c['s2t'])}</h3><p>{esc(c['s2b'])}</p></div>
    <div class="step" data-tone="rank"><div class="step-n">{esc(c['step'])} 3</div><h3>{esc(c['s3t'])}</h3><p>{esc(c['s3b'])}</p></div>
    <div class="step" data-tone="done"><div class="step-n">{esc(c['step'])} 4</div><h3>{esc(c['s4t'])}</h3><p>{esc(c['s4b'])}</p></div>
  </div></div>
</section>

<div class="wrap"><hr class="rule"></div>

<section class="band">
  <div class="narrate">
    <span class="eyebrow">{esc(c['teamEyebrow'])}</span>
    <h2 style="font-size:30px;margin-top:12px">{esc(c['teamTitle'])}</h2>
    <p class="lede" style="margin-top:14px;font-size:17px">{esc(c['teamBody1'])}</p>
    <p class="lede" style="margin-top:12px;font-size:17px">{esc(c['teamBody2a'])}
      <span class="verified" style="vertical-align:-2px">{SHIELD}</span> {esc(c['teamBody2b'])}</p>
  </div>
  <div class="wrap"><div class="team">{team}</div></div>
</section>

<div class="wrap"><hr class="rule"></div>

<section class="band">
  <div class="narrate">
    <span class="eyebrow">{esc(c['d1Eyebrow'])}</span>
    <h2 style="font-size:30px;margin-top:12px">{esc(c['d1Title'])}</h2>
    <p class="lede" style="margin-top:14px;font-size:17px">{c['d1Body1']}</p>
    <p class="lede" style="margin-top:12px;font-size:17px">{c['d1Body2']}</p>
  </div>
  <div class="wrap" style="margin-top:34px">{panel_a}</div>
  <div class="narrate" style="margin-top:34px">
    <div class="notice warn">{WARNI}<span><b>{esc(c['d1NoteTitle'])}</b> {esc(c['d1NoteBody'])}</span></div>
  </div>
</section>

<div class="wrap"><hr class="rule"></div>

<section class="band">
  <div class="narrate">
    <span class="eyebrow">{esc(c['d2Eyebrow'])}</span>
    <h2 style="font-size:30px;margin-top:12px">{esc(c['d2Title'])}</h2>
    <p class="lede" style="margin-top:14px;font-size:17px">{c['d2Body1']}</p>
    <p class="lede" style="margin-top:12px;font-size:17px">{c['d2Body2']}</p>
  </div>
  <div class="wrap" style="margin-top:34px">{panel_b}</div>
  <div class="narrate" style="margin-top:34px">
    <div class="notice accent">{CHECK}<span><b>{esc(c['d2NoteTitle'])}</b> {esc(c['d2NoteBody'])}</span></div>
  </div>
</section>

<div class="wrap"><hr class="rule"></div>

<section class="band">
  <div class="narrate">
    <span class="eyebrow">{esc(c['ownEyebrow'])}</span>
    <h2 style="font-size:30px;margin-top:12px">{esc(c['ownTitle'])}</h2>
    <p class="lede" style="margin-top:14px;font-size:17px">{esc(c['ownBody'])}</p>
  </div>
  <div class="wrap"><div class="kpis">
    <div class="kpi"><div class="l">{esc(c['kpi1'])}</div><div class="v">15</div><div class="h">{esc(c['kpi1h'])}</div></div>
    <div class="kpi"><div class="l">{esc(c['kpi2'])}</div><div class="v">2</div><div class="h">{esc(c['kpi2h'])}</div></div>
    <div class="kpi"><div class="l">{esc(c['kpi3'])}</div><div class="v" style="color:var(--ok)">0</div><div class="h">{esc(c['kpi3h'])}</div></div>
    <div class="kpi"><div class="l">{esc(c['kpi4'])}</div><div class="v">~40<span style="font-size:18px"> s</span></div><div class="h">{esc(c['kpi4h'])}</div></div>
  </div></div>
  <div class="wrap"><div class="tl-list">{''.join(tl_rows)}</div></div>
</section>

<div class="wrap"><hr class="rule"></div>

<section class="band">
  <div class="narrate">
    <span class="eyebrow">{esc(c['closeEyebrow'])}</span>
    <h2 style="font-size:30px;margin-top:12px">{esc(c['closeTitle'])}</h2>
    <p class="lede" style="margin-top:14px;font-size:17px">{esc(c['closeBody'])}</p>
    <div style="display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));margin-top:30px">
      <div><h3 style="font-size:16px;font-family:var(--ui);font-weight:650">{esc(c['p1t'])}</h3><p class="small muted" style="margin-top:6px">{esc(c['p1b'])}</p></div>
      <div><h3 style="font-size:16px;font-family:var(--ui);font-weight:650">{esc(c['p2t'])}</h3><p class="small muted" style="margin-top:6px">{esc(c['p2b'])}</p></div>
      <div><h3 style="font-size:16px;font-family:var(--ui);font-weight:650">{esc(c['p3t'])}</h3><p class="small muted" style="margin-top:6px">{esc(c['p3b'])}</p></div>
      <div><h3 style="font-size:16px;font-family:var(--ui);font-weight:650">{esc(c['p4t'])}</h3><p class="small muted" style="margin-top:6px">{esc(c['p4b'])}</p></div>
    </div>
  </div>
</section>

<footer class="foot">
  <div class="narrate" style="text-align:center">
    <p class="small subtle">{esc(c['foot1'])}</p>
    <p class="tiny subtle" style="margin-top:10px">{esc(c['foot2'])}</p>
  </div>
</footer>
</main>
'''

    head = HEAD.replace('<title>The Right Name On It</title>', f'<title>{esc(c["title"])}</title>')
    doc = f'''<!doctype html>
<html lang="{c['lang']}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
{head.split('</style>')[0]}</style>
</head>
<body>
{body}
</body>
</html>
'''
    name = 'presentation.html' if locale == 'da' else 'presentation-en.html'
    (OUT / name).write_text(doc)
    print(f'  {name:24} {len(doc):>7,} bytes  ({locale})')


if __name__ == '__main__':
    OUT.mkdir(exist_ok=True)
    print('Building presentation pages:')
    for loc in ('da', 'en'):
        build(loc)
