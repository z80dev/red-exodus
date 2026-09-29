"""Build chunky Mars units and a labelled all-unit contact sheet with Blender 5.2."""
import argparse
import json
import math
from pathlib import Path
import sys
import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from units_lib import MATERIALS, box, color, finish, gem, materials, prism, rod

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/models'
PREVIEWS = ROOT / 'art/previews'
IDS = ('settler scout warrior archer spearman horseman swordsman catapult chariot '
       'man_at_arms crossbowman pikeman knight trebuchet musketman cannon lancer '
       'rifleman field_gun cavalry artillery infantry machine_gun at_gun tank '
       'rocket_artillery boat').split()


def person(kind):
    """Compact EVA crew with a large helmet, readable visor, and team shoulder plates."""
    # Feet, armored legs, torso, backpack
    for x in (-4.2, 4.2):
        box('Mag-boot', (x, -1.2, 2.0), (5.1, 7.0, 3.6), 'Basalt', .8)
        box('Shin guard', (x, 0, 6.0), (4.3, 5.8, 6.0), 'Hull', .8)
        box('Knee joint', (x, -2.2, 9.2), (4.2, 2.0, 2.4), 'Hazard', .4)
        box('Thigh suit', (x, 0, 12.5), (5.4, 6.2, 6.5), 'Suit', .8)
    power = kind in ('man_at_arms', 'musketman')
    sleek = kind in ('rifleman', 'infantry')
    torso = (16, 8, 12) if power else (11.8, 6.2, 11) if sleek else (13.0, 7.2, 10.5)
    torso_mat = 'Basalt' if kind == 'warrior' else 'Hull' if power else 'Suit'
    box('Pressure torso', (0, 0, 18.0), torso, torso_mat, 1.2)
    box('Life support chest', (0, -4.0, 18.0), (8.4, 1.5, 7.2), 'Hull', .5)
    box('Crew chest panel', (0, -4.9, 18.1), (5.6, .7, 2.0), 'TEAM', .2)
    box('Life support pack', (0, 4.4, 19.0), (8.2, 5.0, 11.0), 'Hull', 1)
    for x in (-8.4, 8.4):
        rod('Suit arm', (x * .7, 0, 20), (x, -1, 13), 2.7, 'Suit', 7)
        gem('Glove', (x, -1.5, 12.5), (2.7, 3.0, 2.4), 'Basalt')
        shoulder = (6.0, 6.8, 5.6) if power else (4.2, 5.8, 4.6)
        shoulder_mat = 'TEAM' if x < 0 or kind != 'warrior' else 'Basalt'
        box('TEAM shoulder armor', (x, -.4, 22.2), shoulder, shoulder_mat, .7)
        box('Shoulder dark marking', (x, -3.45, 22.2), (2.1, .45, 2.6), 'TEAM_DARK', .2)
    # Oversized helmet and opaque dark faceplate facing Blender -Y / glTF +Z.
    helmet = (6.8, 6.0, 6.5) if sleek else (7.4, 6.5, 7.0)
    gem('Oversized EVA helmet', (0, -.3, 28.0), helmet, 'Suit')
    box('Visor gasket', (0, -5.5, 28.0), (10.7, 1.6, 4.6), 'Basalt', .7)
    box('Cryo cyan visor', (0, -6.45, 28.2), (8.9, .6, 3.0), 'Cryo', .4)
    box('Helmet crown stripe', (0, -1, 34.4), (2.0, 3.0, .8), 'Hazard', .2)
    if kind == 'warrior':
        box('Mismatched shoulder plate', (-8.4, -3.5, 23), (2.0, .5, 3.1), 'Suit', .25)
        box('Patched knee panel', (4.2, -3.1, 10), (2.5, .45, 2), 'Hazard', .2)
    if kind == 'man_at_arms':
        for x in (-8, 8):
            rod('Exo thigh rail', (x, 2, 9), (x*1.2, 2, 17), 1.15, 'TEAM_DARK', 6)
            rod('Exo arm strut', (x*1.25, -1, 13), (x*1.25, -1, 24), 1.15, 'TEAM_DARK', 6)
        box('Exo shoulder yoke', (0, 3.8, 24), (19, 2, 3), 'TEAM_DARK', .6)
    if kind == 'musketman':
        for x in (-11, 11):
            box('Power armor shoulder', (x, 0, 23), (6, 7, 7), 'TEAM_DARK', 1)
            box('Shoulder team inset', (x, -3.7, 23), (3.3, .5, 3.6), 'TEAM', .3)
    # Job-specific chunky equipment silhouettes.
    if kind == 'archer':
        rod('Scoped rifle', (-2, -7, 16), (9, -26, 22), 1.05, 'Basalt', 8)
        box('Rifle receiver', (4, -16, 19), (4, 9, 3), 'Hull', .5)
        rod('Long scope', (2, -12, 20), (6, -21, 22), 1.0, 'Cryo', 8)
        box('Scope mount', (4, -16, 20.5), (1.4, 5, .7), 'Basalt', .2)
    elif kind == 'crossbowman':
        box('Coil rifle chassis', (6, -10, 17), (5, 17, 4), 'TEAM_DARK', .6)
        rod('Coil rifle barrel', (6, -10, 19), (6, -26, 20), .8, 'Basalt', 7)
        for y in (-12, -16, -20):
            rod('Glowing coil ring', (3, y, 18), (9, y, 18), .75, 'Cryo', 9)
    elif kind in ('warrior', 'swordsman', 'man_at_arms', 'musketman', 'rifleman'):
        length = 12 if kind == 'warrior' else 17 if kind in ('man_at_arms', 'musketman') else 16
        box('Carbine receiver', (5.2, -9, 17.2), (4.2, 7, 3.5), 'Hull', .6)
        rod('Rifle barrel', (5.2, -12, 18), (5.2, -12-length, 18.5), 1.0, 'Basalt', 8)
        box('Cryo optic', (5.2, -11, 20), (1.8, 3.4, 1.1), 'Cryo', .2)
        if kind == 'warrior':
            rod('Improvised pipe stock', (3, -7, 14), (7, -10, 15), 1.2, 'Hazard', 6)
        if kind == 'man_at_arms':
            box('Heavy gun receiver', (7, -9, 18), (5.5, 8, 5), 'TEAM_DARK', .6)
    if kind == 'spearman':
        rod('Stun lance', (-9, -1, 8), (-9, -1, 39), 1.0, 'Basalt', 6)
        prism('Lance energy head', [(-11, 36), (-9, 44), (-7, 36)], 2.4, 'Cryo', -1)
    if kind == 'pikeman':
        box('Shoulder launcher tube', (-8, -3, 25), (5.5, 16, 5.5), 'TEAM_DARK', .8)
        rod('Launch tube nozzle', (-8, -11.5, 25), (-8, -13, 25), 2.2, 'Cryo', 8)
        box('Tube team stripe', (-8, -2.8, 28), (2, 13, .8), 'TEAM', .2)
    if kind == 'warrior':
        rod('Crowbar', (-9, -2, 8), (-9, -3, 24), 1.1, 'Hazard', 6)
    if kind in ('swordsman', 'spearman'):
        prism('Team riot shield', [(-15, 9), (-8, 6), (-1, 9), (-1, 23), (-8, 26), (-15, 23)], 2.8, 'TEAM', -5)
        box('Shield dark stripe', (-8, -6.8, 17), (1.8, .5, 12), 'TEAM_DARK', .2)

def titan_frame():
    """A compact bipedal Titan mech with a cockpit core and reverse-joint legs."""
    for x in (-7, 7):
        box('Magnetic mech foot', (x, -2, 2), (8, 10, 4), 'Basalt', .8)
        rod('Reverse-joint shin', (x, 0, 4), (x*1.45, 1, 12), 2.7, 'Hull', 7)
        box('Reverse knee pivot', (x*1.45, -.5, 12), (5.2, 5.5, 5.2), 'TEAM_DARK', .8)
        rod('Mech thigh actuator', (x*1.45, 1, 14), (x, 1, 20), 2.8, 'Hull', 7)
    box('Titan reactor torso', (0, 0, 22), (18, 11, 12), 'TEAM_DARK', 1.2)
    box('Cockpit armor', (0, -5.9, 22), (12, 1, 8), 'Hull', .8)
    box('Cockpit cyan glass', (0, -6.6, 22.2), (9, .5, 5), 'Cryo', .5)
    box('Mech chest crest', (0, -6.95, 17.4), (5, .4, 2.5), 'TEAM', .3)
    gem('Titan sensor head', (0, 0, 31), (5, 5, 3.8), 'Suit')
    for x in (-12, 12):
        box('Mech shoulder shell', (x, 0, 28), (8, 11, 7), 'TEAM', 1)
        rod('Hydraulic arm', (x, 0, 25), (x*1.1, -2, 17), 2.4, 'Hull', 7)
        box('Actuator elbow', (x*1.1, -2, 17), (5, 5, 5), 'TEAM_DARK', .7)
    rod('Titan pulse cannon', (14, -5, 18), (14, -20, 20), 2.1, 'Basalt', 8)
    for z in (11, 13):
        box('TEAM leg armor', (7, -2.9, z), (3, .6, 4), 'TEAM', .3)


def mortar_team():
    """Two-person EVA mortar crew around a forward-tilted tube on field bipod."""
    person('warrior')
    box('Mortar base plate', (13, 0, 2), (12, 12, 2), 'Basalt', .5)
    for x in (9, 17):
        rod('Mortar bipod', (x, 0, 3), (13, -4, 13), 1.1, 'Hull', 6)
    rod('Mortar tube', (13, -3, 9), (13, -12, 24), 3, 'TEAM_DARK', 9, 2)
    rod('Cryo targeting optic', (16, -6, 13), (16, -8, 16), .8, 'Cryo', 6)
    box('TEAM mortar shield', (13, -5, 13), (7, 1.2, 5), 'TEAM', .5)

def tracked_base(name='Tracked base', length=28):
    box(name + ' hull', (0, 1, 9), (20, length, 10), 'Hull', 1.5)
    box(name + ' team stripe', (0, -2, 14), (13, length*.55, 2.4), 'TEAM', .6)
    for x in (-11, 11):
        box(name + ' track shoe', (x, 1, 5), (5, length+4, 9), 'Basalt', 1.5)
        for y in range(-int(length/2), int(length/2)+1, 6):
            box(name + ' tread block', (x, y, 9.8), (5.3, 2.0, .8), 'Hull', .25)
            rod(name + ' idler', (x-2.8, y, 5), (x+2.8, y, 5), 2.2, 'Hull', 8)


def hover_skirt(length=24):
    for x in (-8, 8):
        box('Hovercraft skirt', (x, 0, 8), (4, length, 5), 'Basalt', 1)
        box('Cryo lift glow', (x, -1, 5), (2.4, length*.65, 1), 'Cryo', .25)


def seated_driver():
    box('Driver seat', (0, 3, 15), (8, 7, 6), 'Basalt', .7)
    box('Driver torso', (0, 0, 19), (11, 7, 10), 'Suit', 1)
    gem('Driver helmet', (0, -1, 27), (6.2, 5.5, 6), 'Suit')
    box('Driver visor gasket', (0, -5.8, 27), (8.8, 1, 3.7), 'Basalt', .6)
    box('Driver cryo visor', (0, -6.4, 27), (7, .5, 2.4), 'Cryo', .35)
    for x in (-7, 7):
        box('Driver shoulder insignia', (x, -1, 22), (4, 5, 4), 'TEAM', .6)
        rod('Driver arm', (x, -1, 21), (x*.5, -8, 17), 1.8, 'Hull', 7)
        rod('Seated leg', (x*.4, 2, 15), (x*.8, -5, 11), 2.2, 'Basalt', 7)


def rover(kind):
    """Distinct Mars rovers and walkers, each with a role-readable silhouette."""
    if kind == 'settler':
        tracked_base('Hab crawler', 28)
        box('Folded hab dome crate', (0, 5, 21), (16, 14, 9), 'Suit', 1.2)
        gem('Inflatable hab crown', (0, 5, 27), (7.5, 6.5, 4.3), 'Suit')
        box('Crawler team placard', (0, -2.3, 20), (9, .5, 3.5), 'TEAM', .3)
        box('Crawler team-dark plate', (0, -2.7, 18), (11, .5, 1.4), 'TEAM_DARK', .2)
        box('Folded solar wing', (0, 6, 17), (20, 3, 1.3), 'Solar', .2)
        return
    if kind == 'scout':
        box('Scout rover hull', (0, 0, 8), (16, 20, 7), 'Hull', 1.4)
        box('Scout team door', (0, -1, 12), (12, 11, 2), 'TEAM', .5)
        box('Scout dark rocker trim', (0, -4, 6), (16, 1, 2.4), 'TEAM_DARK', .3)
        for x in (-9, 9):
            for y in (-7, 7):
                rod('Scout balloon tire', (x-1.2, y, 5), (x+1.2, y, 5), 3.8, 'Basalt', 9)
        box('Rover cockpit', (0, -7, 16), (11, 2, 5), 'Cryo', .7)
        rod('Dish support mast', (-3, 1, 12), (-3, 1, 26), .7, 'Hull', 7)
        gem('Large survey dish', (-3, 1, 27), (6.5, 1.5, 6.5), 'Suit')
        gem('Dish cyan lens', (-3, -.2, 27), (2.1, .7, 2.1), 'Cryo')
        return
    if kind == 'horseman':
        for x in (-11, 11):
            for y in (-9, 8):
                rod('Balloon tire', (x-2, y, 5), (x+2, y, 5), 5.3, 'Basalt', 10)
                rod('Wheel hub', (x-2.2, y, 5), (x+2.2, y, 5), 2.1, 'Hazard', 8)
        box('Dune buggy chassis', (0, 0, 10), (17, 23, 7), 'Hull', 1.2)
        box('Buggy team door', (0, -1, 13), (12, 15, 1.4), 'TEAM', .4)
        for x in (-8, 8):
            rod('Open roll cage', (x, 4, 13), (x, 2, 31), 1.2, 'TEAM_DARK', 7)
            rod('Windshield cage', (x, 2, 31), (x, -8, 24), 1.2, 'TEAM_DARK', 7)
        rod('Roll cage roof', (-8, 2, 31), (8, 2, 31), 1.2, 'TEAM_DARK', 7)
        seated_driver()
        return
    if kind == 'chariot':
        for x in (-11, 11):
            for y in (-10, 0, 10):
                rod('Six wheel rover tire', (x-1.8, y, 5), (x+1.8, y, 5), 4.7, 'Basalt', 9)
                rod('Wheel team hub', (x-2, y, 5), (x+2, y, 5), 2.0, 'TEAM', 8)
        box('Assault rover hull', (0, 0, 11), (21, 29, 12), 'Hull', 1.8)
        box('Assault rover team stripe', (0, -3, 16), (12, 20, 2.5), 'TEAM', .7)
        box('Turret', (0, 2, 21), (14, 13, 8), 'Basalt', 1.2)
        box('Turret team side panel', (0, -4.8, 22), (10, .7, 4), 'TEAM_DARK', .4)
        rod('Turret cannon', (0, -4, 22), (0, -22, 23), 1.8, 'Hull', 8)
        return
    if kind == 'knight':
        hover_skirt(25)
        prism('Hover bike wedge', [(-6, 5), (6, 5), (5, 15), (0, 20), (-5, 15)], 16, 'Hull', 0)
        box('Bike team nose', (0, -7, 13), (7, 6, 2.4), 'TEAM', .6)
        box('Bike dark side rail', (0, -5.5, 10.5), (11, .5, 1.2), 'TEAM_DARK', .2)
        seated_driver()
        return
    if kind == 'lancer':
        for x in (-10, 10):
            for y in (-9, 0, 9):
                rod('Strike rover tire', (x-1.7, y, 5), (x+1.7, y, 5), 4.2, 'Basalt', 8)
        prism('Wedge strike hull', [(-11, 7), (11, 7), (10, 14), (0, 19), (-10, 14)], 27, 'Hull', 1)
        box('Team wedge stripe', (0, -6, 13), (3.2, 13, 1.6), 'TEAM', .3)
        box('Strike rover dark nose inset', (0, -7, 15), (5, .8, 2), 'TEAM_DARK', .3)
        box('Strike rover cockpit', (0, -8, 18), (10, 2, 4), 'Cryo', .6)
        return
    if kind == 'cavalry':
        hover_skirt(25)
        box('Open hover platform', (0, 1, 12), (19, 24, 5), 'Hull', 1.2)
        box('Gunner team panel', (0, -4, 15), (13, 12, 2), 'TEAM', .5)
        seated_driver()
        box('Gun mount', (0, 5, 18), (10, 9, 4), 'TEAM_DARK', .7)
        for x in (-3, 0, 3):
            rod('Skimmer pulse cannon', (x, 1, 20), (x, -12, 20), .8, 'Cryo', 7)
        return
    if kind == 'tank':
        hover_skirt(31)
        box('Hovertank armored hull', (0, 0, 12), (25, 32, 13), 'Hull', 2)
        box('Hovertank team stripe', (0, -8, 16), (15, 15, 2), 'TEAM', .5)
        box('Hovertank turret', (0, 3, 22), (16, 16, 8), 'Basalt', 1.5)
        box('Turret team plate', (0, -5.2, 23), (9, .6, 4), 'TEAM_DARK', .3)
        rod('Hovertank long barrel', (0, -4, 23), (0, -29, 24), 2.0, 'Hull', 9)
        return
    if kind in ('trebuchet', 'rocket_artillery'):
        tracked_base('Rail mortar' if kind == 'trebuchet' else 'Swarm launcher', 31)
        if kind == 'trebuchet':
            box('Rail carriage', (0, 4, 17), (9, 23, 4), 'TEAM_DARK', .7)
            box('Railgun coil rail', (0, -1, 21), (4, 26, 4), 'Hull', .6)
            for y in (-9, -3, 3, 9):
                box('Rail accelerator coil', (0, y, 21), (7, 2.2, 6.5), 'Cryo', .6)
            rod('Rail projectile', (0, -14, 22), (0, -19, 22), 1.3, 'Hazard', 7)
        else:
            box('Swarm missile box', (0, 3, 22), (18, 15, 11), 'TEAM_DARK', 1)
            for x in (-6, 0, 6):
                for z in (20, 25):
                    rod('Raised missile tube', (x, -3, z), (x, -12, z+6), 2.2, 'Hull', 8)
                    rod('Missile nose', (x, -12, z+6), (x, -14, z+7.5), 1.2, 'Hazard', 7, 0)
        return
    if kind == 'field_gun':
        box('Tripod plasma caster core', (0, -2, 20), (10, 8, 9), 'Basalt', 1)
        gem('Glowing plasma chamber', (0, -6, 20), (4.6, 2.5, 4.6), 'Cryo')
        rod('Plasma barrel', (0, -5, 20), (0, -22, 21), 1.8, 'TEAM_DARK', 8)
        for x, y in ((-10, 4), (10, 4), (0, 10)):
            rod('Caster tripod leg', (0, 0, 15), (x, y, 1), 1.2, 'Hull', 7)
        box('Caster team shield', (0, -4, 16), (16, 1.4, 7), 'TEAM', .8)
        box('Plasma caster dark power rail', (0, 3, 22), (4, 3, 2), 'TEAM_DARK', .4)
        return
    if kind == 'machine_gun':
        box('Pulse walker reactor', (0, 0, 15), (12, 12, 12), 'Hull', 1)
        box('Walker team armor', (0, -6.3, 16), (9, .7, 5), 'TEAM', .4)
        for x in (-10, 10):
            for y in (-6, 6):
                rod('Walker leg upper', (x*.35, y*.4, 13), (x, y, 5), 1.7, 'Basalt', 7)
                rod('Walker leg lower', (x, y, 5), (x*1.2, y*1.3, 1), 1.2, 'Hull', 7)
        box('Rotary gun housing', (0, -7, 23), (10, 8, 6), 'TEAM_DARK', 1)
        for x in (-3.2, 0, 3.2):
            rod('Rotary pulse barrel', (x, -10, 22), (x, -26, 23), 1.2, 'Cryo', 8)
        return
    if kind == 'at_gun':
        box('Lance walker reactor', (0, 1, 14), (13, 15, 11), 'Hull', 1)
        box('Lance walker team plate', (0, -6.7, 15), (10, .7, 6), 'TEAM', .4)
        for x in (-1, 1):
            for y in (-1, 1):
                a, b = x*4.5, y*7
                rod('Spider leg upper', (x*2, y*3, 13), (a, b, 7), 1.4, 'Basalt', 7)
                rod('Spider leg lower', (a, b, 7), (a*1.5, b*1.5, 1), 1.0, 'Hull', 7)
        rod('Lance cannon', (0, -4, 18), (0, -31, 19), 2.0, 'TEAM_DARK', 9)
        for y in (-9, -14, -19):
            rod('Lance coil', (-3, y, 18), (3, y, 18), .8, 'Cryo', 8)
        return
    if kind == 'cannon':
        for x in (-11, 11):
            rod('Mass-driver tow wheel', (x-1.5, 1, 5), (x+1.5, 1, 5), 4.2, 'Basalt', 9)
            rod('Tow wheel team hub', (x-1.7, 1, 5), (x+1.7, 1, 5), 1.7, 'TEAM', 8)
        box('Mass-driver tow carriage', (0, 2, 11), (15, 18, 6), 'Hull', 1)
        rod('Mass-driver barrel', (0, -2, 15), (0, -29, 17), 2.2, 'Basalt', 9)
        for y in (-7, -12, -17, -22):
            rod('Mass-driver accelerator coil', (-4, y, 15.5), (4, y, 16.1), 1.2, 'Cryo', 9)
        box('Tow shield team panel', (0, -5, 13), (16, 1.2, 6), 'TEAM', .6)
        box('Mass-driver dark shield', (0, -5.8, 14), (8, .4, 3), 'TEAM_DARK', .3)
        return
    if kind == 'artillery':
        tracked_base('Arc howitzer', 30)
        box('Howitzer recoil cradle', (0, 2, 17), (16, 14, 7), 'TEAM_DARK', 1)
        rod('Arc howitzer barrel', (0, -3, 20), (0, -26, 24), 2.6, 'Hull', 10)
        for y in (-8, -13, -18, -23):
            rod('Arc capacitor ring', (-4.5, y, 21), (4.5, y, 22), 1.35, 'Cryo', 10)
        box('Howitzer team armor', (0, -6, 16), (17, 1.4, 8), 'TEAM', .7)
        return


def skiff():
    # Dust-skimming sand yacht; wide hull, bow +Z after export, fan sail and team markings.
    prism('Dust skiff hull', [(-9, 5), (9, 5), (7, 11), (0, 15), (-7, 11)], 15, 'TEAM_DARK', 0)
    box('Skiff deck', (0, 0, 12), (13, 20, 2), 'Hull', .6)
    rod('Fan mast', (0, 1, 13), (0, 1, 32), .8, 'Basalt', 7)
    prism('Dust sail', [(-8, 17), (8, 17), (6, 29), (-5, 26)], 1.2, 'TEAM', 0)
    box('Sail team-dark stripe', (0, -.8, 23), (2, .6, 10), 'TEAM_DARK', .2)
    for x in (-5, 5):
        prism('Runner ski', [(x-1.4, 0), (x+1.4, 0), (x+1, 4), (x, 6), (x-1, 4)], 22, 'Basalt', 0)
    rod('Fan axle', (-4, 0, 28), (4, 0, 28), 1.4, 'Cryo', 8)
    for x in (-5, 5):
        prism('Fan blade', [(x, 28), (x*1.35, 31), (x*1.2, 25)], 1, 'Cryo', 0)


def build(kind):
    if kind == 'boat':
        skiff()
    elif kind == 'catapult':
        mortar_team()
    elif kind == 'infantry':
        titan_frame()
    elif kind in ('settler', 'scout', 'horseman', 'knight', 'lancer', 'cavalry', 'chariot', 'tank', 'rocket_artillery', 'field_gun', 'artillery', 'at_gun', 'cannon', 'trebuchet', 'machine_gun'):
        rover(kind)
    else:
        person(kind)


def export(kind):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    build(kind)
    obj = finish('u_' + kind)
    # Normalize models to the shared miniature scale while preserving their ground origin.
    height = max(vertex.co.z for vertex in obj.data.vertices)
    factor = .32 / height
    for vertex in obj.data.vertices:
        vertex.co.x *= factor
        vertex.co.y *= factor
        vertex.co.z *= factor
    tris = len(obj.data.polygons)
    assert tris <= 1500, f'u_{kind}: {tris} triangles exceeds 1500'
    names = {mat.name for mat in obj.data.materials}
    assert {'TEAM', 'TEAM_DARK'} <= names
    points = [(v.co.x, v.co.z, -v.co.y) for v in obj.data.vertices]
    minimum = [round(min(p[i] for p in points), 6) for i in range(3)]
    maximum = [round(max(p[i] for p in points), 6) for i in range(3)]
    assert minimum[1] >= -.00001 and .25 <= maximum[1] <= .55, (kind, minimum, maximum)
    bpy.ops.export_scene.gltf(filepath=str(OUT / ('u_' + kind + '.glb')), export_format='GLB',
        use_selection=True, export_yup=True, export_apply=True, export_cameras=False,
        export_lights=False, export_animations=False, export_materials='EXPORT',
        export_texcoords=False, export_normals=True)
    print(f"UNIT_OK u_{kind}: {tris} tris; bounds {minimum} -> {maximum}", flush=True)
    return {'key': 'u_' + kind, 'file': f'/models/u_{kind}.glb', 'tris': tris,
            'bbox': {'min': minimum, 'max': maximum}}


def contact_sheet():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    # Lay minis on a ground-plane grid and render them from the game's 3/4 overhead view.
    for i, kind in enumerate(IDS):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(OUT / f'u_{kind}.glb'))
        meshes = [o for o in set(bpy.data.objects) - before if o.type == 'MESH']
        col, row = i % 6, i // 6
        center = Vector(((col - 2.5) * .91, (2 - row) * .93, 0))
        for obj in meshes:
            obj.rotation_euler = (0, 0, math.radians(-16))
            obj.location = center
        curve = bpy.data.curves.new(kind + ' label', 'FONT')
        curve.body = kind.replace('_', ' ').upper()
        curve.align_x = 'CENTER'
        curve.size = .055
        label = bpy.data.objects.new('Label ' + kind, curve)
        bpy.context.collection.objects.link(label)
        label.location = center + Vector((0, -.36, .006))
        curve.materials.append(MATERIALS['Suit'])
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1800
    scene.render.resolution_y = 1450
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'AgX'
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = color('392d29')
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .45
    bpy.ops.object.camera_add(location=(0, -8, 8))
    camera = bpy.context.object
    camera.rotation_euler = (Vector((0, 0, .2)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 6.4
    scene.camera = camera
    for location, energy, size in (((-3, -4, 8), 900, 5), ((4, 2, 6), 500, 4)):
        bpy.ops.object.light_add(type='AREA', location=location)
        light = bpy.context.object
        light.data.energy = energy
        light.data.shape = 'DISK'
        light.data.size = size
        light.rotation_euler = (Vector((0, 0, 1.4)) - light.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.film_transparent = False
    scene.render.filepath = str(PREVIEWS / 'units_mars.png')
    bpy.ops.render.render(write_still=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only', help='Comma-separated unit ids')
    parser.add_argument('--no-preview', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    selected = args.only.split(',') if args.only else IDS
    assert set(selected) <= set(IDS), 'Unknown unit id'
    OUT.mkdir(parents=True, exist_ok=True)
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    materials()
    manifest = OUT / 'manifest.units.json'
    entries = {entry['key']: entry for entry in json.loads(manifest.read_text())} if manifest.exists() else {}
    for kind in selected:
        entry = export(kind)
        entries[entry['key']] = entry
    manifest.write_text(json.dumps([entries['u_' + kind] for kind in IDS], indent=2) + '\n')
    if not args.no_preview:
        assert all((OUT / f'u_{kind}.glb').exists() for kind in IDS), 'Build every unit before previewing'
        contact_sheet()
    print(f'UNITS_COMPLETE {len(entries)} manifest entries', flush=True)


if __name__ == '__main__':
    main()
