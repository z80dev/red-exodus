"""Mars colony perimeter kit: regolith berms, plated blast walls, energy pylons."""

import math
from city_lib import Model


def wall_seg_0(m: Model):
    # A low packed-regolith berm with visible sandbag courses and orange marker stakes.
    m.box(1.0, .14, .09, (0, 0, 0), "regolith", bevel=.035, top=(.76, .65))
    for x in (-.39, -.2, 0, .2, .39):
        m.box(.17, .09, .038, (x, -.004, .09), "regolith_dark", bevel=.016, top=(.8, .8))
    for x in (-.45, .45):
        m.box(.018, .1, .11, (x, -.01, .005), "hazard", bevel=.003)
    m.box(.09, .012, .024, (0, -.071, .08), "TEAM", bevel=.002)
    m.miter_ends()


def wall_tower_0(m: Model):
    # Berm node with stacked sandbags and a warning beacon.
    m.cyl(.105, .13, (0, 0, 0), "regolith", seg=6, r2=.12)
    m.box(.2, .18, .045, (0, 0, .13), "regolith_dark", bevel=.02)
    m.box(.12, .1, .035, (0, -.01, .175), "TEAM_DARK", bevel=.012)
    m.cyl(.008, .07, (0, .02, .21), "iron", seg=5)
    m.cyl(.022, .018, (0, .02, .28), "hazard", seg=6)
    m.box(.055, .014, .025, (0, -.105, .145), "TEAM", bevel=.003)


def wall_seg_1(m: Model):
    # Overlapping armored blast plates over a concrete footing.
    m.box(1.0, .12, .035, (0, .015, 0), "concrete_dark", bevel=.008)
    m.box(1.0, .075, .17, (0, 0, .035), "iron", bevel=.008, top=(.92, .8))
    for x in (-.4, -.2, 0, .2, .4):
        m.box(.012, .01, .15, (x, -.042, .045), "concrete_light", bevel=.002)
        m.box(.05, .012, .018, (x, -.05, .09), "hazard", bevel=.002)
    m.box(.12, .012, .025, (0, -.044, .13), "TEAM", bevel=.002)
    m.miter_ends()


def wall_tower_1(m: Model):
    # Reinforced blast-wall junction with an armored lookout and antenna.
    m.box(.23, .2, .25, (0, 0, 0), "concrete_dark", bevel=.025)
    m.box(.19, .16, .045, (0, 0, .25), "iron", bevel=.01)
    m.box(.13, .09, .06, (0, -.02, .295), "glass", bevel=.01)
    m.box(.05, .014, .06, (0, -.07, .275), "TEAM", bevel=.003)
    m.cyl(.007, .075, (.07, .04, .34), "iron", seg=5)
    m.cyl(.02, .014, (.07, .04, .415), "hazard", seg=6)


def wall_seg_2(m: Model):
    # Force-field wall: compact emitters joined by a segmented energy ribbon.
    m.box(1.0, .12, .03, (0, 0, 0), "concrete_dark", bevel=.006)
    for x in (-.46, -.23, 0, .23, .46):
        m.box(.025, .07, .22, (x, 0, .03), "iron", bevel=.004)
        m.cyl(.018, .018, (x, 0, .25), "cryo", seg=6)
        m.box(.14, .008, .09, (x, -.01, .09), "glass", bevel=.003)
    m.box(.94, .012, .018, (0, 0, .18), "TEAM", bevel=.003)
    m.miter_ends()


def wall_tower_2(m: Model):
    # Tall shield pylons project a cyan energy cap; the team-colored emitter is prominent.
    m.cyl(.095, .31, (0, 0, 0), "iron", seg=7, r2=.07)
    m.box(.18, .15, .04, (0, 0, .03), "concrete_dark", bevel=.01)
    m.box(.15, .09, .04, (0, -.015, .12), "TEAM_DARK", bevel=.01)
    m.cyl(.043, .025, (0, 0, .31), "cryo", seg=7)
    m.dome(.055, .065, (0, 0, .33), "glass", seg=8, rings=2)
    for a in range(4):
        ang = math.tau * a / 4
        m.box(.02, .02, .14, (.075*math.cos(ang), .075*math.sin(ang), .08), "hazard", bevel=.003)
    m.flag(.045, .028, (0, -.08, .12), "TEAM", pole_h=.04, finial=None)


WALLS = {"wall_seg_0": wall_seg_0, "wall_tower_0": wall_tower_0,
         "wall_seg_1": wall_seg_1, "wall_tower_1": wall_tower_1,
         "wall_seg_2": wall_seg_2, "wall_tower_2": wall_tower_2}
