"""Device regression for the 411x914/density160 reference viewport.
Open the blank Keyflow comparison editor in letters mode first.
Usage: python3 scripts/test-android-interactions.py /path/to/adb emulator-5568
Only acts on the explicitly supplied device and Keyflow example editor.
"""
import json, subprocess, sys, time, xml.etree.ElementTree as ET
adb_path, serial = sys.argv[1:3]
results = []
def adb(*args):
    return subprocess.check_output([adb_path, '-s', serial, *map(str,args)],timeout=40)
def tap(x,y):
    adb('shell','input','tap',x,y)
    time.sleep(.08)
def hold(x,y,ms=1300):
    adb('shell','input','swipe',x,y,x,y,ms)
def nodes():
    adb('shell','uiautomator','dump','/sdcard/keyflow-interaction-ui.xml')
    return ET.fromstring(adb('exec-out','cat','/sdcard/keyflow-interaction-ui.xml')).iter('node')
def value():
    matches=[n for n in nodes() if n.get('content-desc')=='Try Keyflow']
    assert matches, 'Open the Keyflow example comparison editor first'
    return matches[0].get('text')
def check(name,expected):
    actual=value()
    assert actual==expected,(name,expected,actual)
    results.append({'check':name,'text':actual,'pass':True})
    print(json.dumps(results[-1],ensure_ascii=False),flush=True)
def clear():
    adb('shell','input','keyevent','KEYCODE_MOVE_END')
    hold(377,794)
    check('held delete clears editor','Write something…')
assert b'411x914' in adb('shell','wm','size'), 'Pinned 411x914 viewport required'
assert value()=='Write something…', 'Start with an empty editor'
# Force sentence capitalization from a real text change.
tap(43,735);clear()
tap(31,794);tap(31,794);tap(245,735);tap(245,735)
check('double shift caps lock','HH')
tap(31,794);clear()
tap(245,735);tap(306,677);tap(225,854);tap(225,854)
check('typing and double-space sentence','Hi. ')
clear()
hold(22,677,650)
check('held Q inserts number hint','1')
clear()
tap(31,854);time.sleep(.3);tap(22,677);tap(22,735);tap(31,854);time.sleep(.3)
check('numeric and symbol layout','1@')
clear()
tap(43,735);tap(245,794);tap(163,794)
check('automatic case','Abc')
adb('shell','input','swipe',225,854,165,854,300)
tap(123,794)
check('space-bar cursor movement','xAbc')
clear()
# Native mode handoff and restoration use the same editor.
tap(22,677);tap(62,677)
check('before system handoff','Qw')
tap(295,118);time.sleep(1.5)
tap(102,677)
check('system Gboard types in shared editor','Qwe')
tap(110,118);time.sleep(1.5)
check('return from system preserves text','Qwe')
adb('shell','input','keyevent','KEYCODE_BACK')
assert any(n.get('text')=='Keyboard playground' for n in nodes()), 'Back navigated away instead of hiding keyboard'
results.append({'check':'first Back dismisses keyboard without navigating','pass':True})
print(json.dumps({'result':'PASS','checks':len(results),'results':results},ensure_ascii=False),flush=True)
