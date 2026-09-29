"""Mars colony centers, evolving from an emergency lander to a terraformed dome-city."""

import math
from city_lib import Model


def center_0(m: Model):
    # The Ark's squat lander, four deployed legs, lander feet, and comms mast.
    m.box(.34, .28, .12, (0, 0, .09), "concrete_light", bevel=.025)
    m.box(.27, .22, .055, (0, 0, .21), "concrete", bevel=.025)
    m.dome(.12, .055, (0, 0, .265), "glass", seg=8, rings=2)
    for x in (-.17, .17):
        for y in (-.13, .13):
            m.box(.025, .025, .12, (x, y, 0), "iron", bevel=.006, rx=10 if x < 0 else -10)
            m.box(.07, .05, .018, (x * 1.12, y * 1.18, 0), "TEAM_DARK", bevel=.005)
    m.cyl(.009, .205, (.12, .08, .32), "iron", seg=5)
    m.flag(.055, .035, (.12, .08, .525), "TEAM", pole_h=.018, finial=None)
    m.box(.16, .055, .012, (-.06, -.17, .12), "solar", bevel=.003)


def center_1(m: Model):
    # Inflatable pressure habs with airlocks and a clear solar array.
    m.box(.32, .3, .035, (0, 0, 0), "concrete", bevel=.008)
    for x, y, r in ((-.09, 0, .13), (.09, .03, .105), (0, -.09, .075)):
        m.dome(r, r * .72, (x, y, .055), "hab_white", seg=9, rings=3, base=.025)
        m.box(.028, .014, .045, (x, y - r, .065), "TEAM", bevel=.003)
    m.box(.29, .085, .012, (0, .17, .06), "solar", bevel=.003)
    for x in (-.11, -.055, 0, .055, .11):
        m.box(.006, .085, .013, (x, .17, .061), "iron")
    m.cyl(.008, .3, (.19, .05, .055), "iron", seg=5)
    m.flag(.05, .03, (.19, .05, .355), "TEAM", pole_h=.035, finial=None)


def center_2(m: Model):
    # Low, thick regolith berm shielding the central pressure dome.
    m.cyl(.285, .065, (0, 0, 0), "regolith", seg=10, r2=.25)
    m.dome(.175, .15, (0, 0, .065), "glass", seg=10, rings=3, base=.015)
    m.box(.045, .035, .055, (0, -.22, .04), "TEAM", bevel=.006)
    for a in range(8):
        ang = math.tau * a / 8
        m.box(.038, .028, .04, (.26 * math.cos(ang), .26 * math.sin(ang), .055), "regolith_dark", bevel=.006, rz=math.degrees(ang))
    m.cyl(.008, .25, (.18, .1, .07), "iron", seg=5)
    m.flag(.05, .03, (.18, .1, .32), "TEAM", pole_h=.03, finial=None)


def center_3(m: Model):
    # Several connected pressure domes beneath a prominent communications tower.
    m.cyl(.29, .035, (0, 0, 0), "concrete", seg=10)
    for x, y, r, h in ((-.12, 0, .13, .12), (.1, .04, .12, .14), (0, -.12, .09, .1)):
        m.dome(r, h, (x, y, .035), "glass", seg=9, rings=3, base=.015)
        m.box(.026, .012, .04, (x, y-r, .045), "TEAM", bevel=.002)
    m.box(.045, .04, .18, (0, .17, .035), "concrete_light", bevel=.008)
    m.cyl(.007, .19, (0, .17, .21), "iron", seg=5)
    m.flag(.06, .035, (0, .17, .39), "TEAM", pole_h=.035, finial=None)
    m.box(.2, .045, .012, (-.13, -.2, .04), "solar", bevel=.002)


def center_4(m: Model):
    # Tall glass arcology towers linked by enclosed skybridges.
    m.box(.29, .27, .055, (0, 0, 0), "concrete", bevel=.018)
    for x, y, w, d, h in ((-.105, .015, .09, .1, .37), (0, .03, .1, .11, .45), (.105, .015, .09, .1, .32), (0, -.095, .085, .08, .28)):
        m.box(w, d, h, (x, y, .05), "glass", bevel=.012)
        m.box(w+.012, d+.012, .018, (x, y, .05+h*.53), "concrete_light", bevel=.003)
        m.box(w+.014, d+.014, .014, (x, y, .05+h), "TEAM_DARK", bevel=.003)
    m.box(.22, .025, .035, (0, .01, .24), "concrete_light", bevel=.004)
    m.box(.16, .045, .012, (-.11, -.19, .055), "solar", bevel=.002)


def center_5(m: Model):
    # A bright, self-contained dome-city with greenery and an unmistakably blue glass crown.
    m.cyl(.3, .045, (0, 0, 0), "concrete_light", seg=12, bevel=.006)
    m.dome(.285, .46, (0, 0, .035), "glass", seg=12, rings=5, base=.025)
    for x, y, h in ((-.13, 0, .19), (.11, .03, .26), (0, -.13, .16), (.02, .13, .2)):
        m.box(.055, .05, h, (x, y, .045), "hab_white", bevel=.008)
        m.box(.06, .008, .012, (x, y-.027, .1+h*.55), "TEAM", bevel=.002)
    for x, y in ((-.2, -.1), (.19, -.11), (-.17, .15), (.17, .16)):
        m.cyl(.012, .07, (x, y, .045), "lichen", seg=5, r2=.018)
    m.cyl(.01, .13, (0, .21, .04), "iron", seg=5)
    m.flag(.05, .03, (0, .21, .17), "TEAM", pole_h=.035, finial=None)


CENTERS = {f"city_center_{i}": fn for i, fn in enumerate((center_0, center_1, center_2, center_3, center_4, center_5))}
