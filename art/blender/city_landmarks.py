"""Mars landmark buildings. Legacy model keys now build the fixed RED EXODUS landmarks."""

import math
from city_lib import Model


def base(m, mat="concrete"):
    m.box(.48, .42, .025, (0, 0, 0), mat, bevel=.008)


def entry(m, z=.02):
    m.box(.045, .014, .055, (0, -.205, z), "TEAM", bevel=.003)


def bld_temple(m: Model):
    # Memorial Chapel: quiet pale sanctuary, remembrance dome, and candles for Earth.
    base(m, "hab_white")
    m.box(.25, .26, .11, (0, .015, .025), "concrete_light", bevel=.012)
    m.dome(.105, .13, (0, .025, .135), "glass", seg=9, rings=3)
    m.cyl(.012, .07, (0, .025, .265), "gold", seg=6)
    for x in (-.105, .105):
        m.box(.025, .03, .13, (x, -.06, .025), "TEAM_DARK", bevel=.006)
    entry(m)
    for x in (-.14, .14): m.cyl(.012, .035, (x, -.14, .025), "hazard", seg=5)


def bld_library(m: Model):
    # Data Archive: a fortified records vault with stacked illuminated data fins.
    base(m, "concrete_dark")
    m.box(.32, .29, .19, (0, .015, .025), "concrete_light", bevel=.014)
    m.box(.22, .19, .06, (0, .015, .215), "iron", bevel=.01)
    for x in (-.09, -.045, 0, .045, .09):
        m.box(.018, .14, .115, (x, -.045, .055), "glass", bevel=.003)
    m.box(.13, .026, .06, (0, -.17, .025), "TEAM", bevel=.004)
    m.cyl(.012, .05, (0, .015, .275), "cryo", seg=6)


def bld_market(m: Model):
    # Exchange: central transaction hub with four modular trading kiosks.
    base(m)
    m.cyl(.09, .17, (0, .015, .025), "concrete_light", seg=8, bevel=.006)
    m.dome(.074, .085, (0, .015, .195), "glass", seg=8, rings=2)
    for a in range(4):
        ang = math.tau*a/4
        x, y = .16*math.cos(ang), .16*math.sin(ang)
        m.box(.09, .075, .075, (x, y, .025), "hab_white", bevel=.008, rz=math.degrees(ang))
        m.box(.055, .008, .028, (x, y-.04, .035), "TEAM", bevel=.002, rz=math.degrees(ang))
    m.cyl(.022, .022, (0, .015, .28), "gold", seg=6)


def bld_barracks(m: Model):
    # Armory: armored bunker, heavy doors, and unmistakable paired weapon racks.
    base(m, "concrete_dark")
    m.box(.34, .25, .14, (0, .02, .025), "iron", bevel=.014)
    m.box(.15, .018, .09, (0, -.112, .04), "TEAM", bevel=.004)
    for x in (-.13, .13):
        m.box(.07, .09, .105, (x, .01, .165), "concrete", bevel=.008)
        m.box(.04, .012, .08, (x, -.04, .18), "hazard", bevel=.003)
    m.box(.12, .07, .035, (0, .015, .165), "concrete_light", bevel=.006)


def bld_harbor(m: Model):
    # Skiff Dock: dry-dock cradle, dust skiff hull, gantry and landing lights.
    base(m, "asphalt")
    m.box(.31, .22, .045, (0, .045, .025), "concrete", bevel=.008)
    m.box(.23, .065, .045, (0, -.01, .07), "TEAM_DARK", bevel=.016, top=(.74, .85))
    m.box(.29, .025, .15, (-.14, .07, .035), "iron", bevel=.006)
    m.box(.025, .22, .15, (-.265, .07, .035), "iron", bevel=.005)
    for x in (-.19, .19): m.cyl(.012, .018, (x, -.105, .027), "hazard", seg=6)
    m.flag(.055, .035, (.16, .16, .18), "TEAM", pole_h=.08, finial=None)


def bld_granary(m: Model):
    # Seed Silo: pressure-rated seed canisters and a bright biosecurity cap.
    base(m, "regolith_dark")
    for x, y, r, h in ((-.12, 0, .065, .19), (0, .035, .075, .25), (.12, 0, .065, .19)):
        m.cyl(r, h, (x, y, .025), "hab_white", seg=8, r2=r*.86, bevel=.006)
        m.dome(r*.86, .035, (x, y, .025+h), "lichen", seg=8, rings=2)
        m.box(r*1.3, .012, .032, (x, y-r, .045), "TEAM", bevel=.002)
    m.box(.32, .05, .02, (0, -.18, .03), "concrete", bevel=.004)


def bld_workshop(m: Model):
    # Fabricator: industrial shell, articulated robotic arm and molten-metal furnace.
    base(m, "concrete_dark")
    m.box(.3, .25, .16, (0, .025, .025), "concrete", bevel=.01)
    m.box(.16, .11, .07, (0, .025, .185), "iron", bevel=.006)
    m.cyl(.045, .07, (.13, -.07, .025), "hazard", seg=7, r2=.032)
    m.cyl(.028, .04, (.13, -.07, .095), "fire", seg=7)
    m.cyl(.009, .12, (-.14, -.06, .03), "iron", seg=5, ry=90)
    m.box(.055, .035, .025, (-.19, -.06, .13), "TEAM", bevel=.004)
    m.box(.18, .012, .08, (0, -.11, .07), "glass", bevel=.003)


def bld_university(m: Model):
    # Research Institute: clean laboratory wings around an antenna dish and instrument mast.
    base(m, "hab_white")
    for x, y, w, d, h in ((-.12, 0, .13, .25, .15), (.12, 0, .13, .25, .15), (0, .07, .15, .12, .11)):
        m.box(w, d, h, (x, y, .025), "concrete_light", bevel=.009)
        m.box(w*.78, .01, .028, (x, y-d/2-.005, .06), "glass", bevel=.002)
    m.cyl(.007, .14, (0, .11, .135), "iron", seg=5)
    m.dome(.065, .045, (0, .11, .275), "cryo", seg=8, rings=2)
    m.box(.065, .02, .055, (0, -.14, .025), "TEAM", bevel=.004)


def bld_amphitheater(m: Model):
    # Holo-Theater: open stepped audience bowl surrounding a hologram emitter.
    base(m, "concrete_dark")
    for r, z, h in ((.21, .025, .035), (.17, .06, .035), (.13, .095, .035)):
        m.cyl(r, h, (0, .015, z), "concrete", seg=10, r2=r*.88)
    m.cyl(.045, .14, (0, .015, .13), "cryo", seg=8, r2=.025)
    m.dome(.06, .055, (0, .015, .27), "glass", seg=8, rings=2)
    m.box(.075, .025, .06, (0, -.17, .025), "TEAM", bevel=.004)


def bld_bank(m: Model):
    # Credit Vault: compact armored vault, heavy round door, and gold balance beacon.
    base(m, "concrete_dark")
    m.box(.31, .28, .2, (0, .025, .025), "concrete_light", bevel=.014)
    m.cyl(.072, .024, (0, -.127, .09), "gold", seg=10, ry=90)
    m.cyl(.047, .03, (0, -.145, .09), "iron", seg=8, ry=90)
    m.cyl(.009, .13, (0, .025, .225), "gold", seg=5)
    m.dome(.035, .035, (0, .025, .355), "gold", seg=7, rings=2)
    m.box(.1, .018, .04, (0, -.13, .21), "TEAM", bevel=.003)


def bld_factory(m: Model):
    # Foundry: broad fabrication hall, striped stack and glowing furnace mouth.
    base(m, "asphalt")
    m.box(.35, .29, .16, (0, .015, .025), "iron", bevel=.008, top=(.88, .9))
    for x in (-.1, 0, .1): m.box(.055, .2, .06, (x, .02, .185), "concrete_dark", bevel=.004)
    m.cyl(.035, .2, (.15, .11, .025), "concrete", seg=7)
    for z in (.075, .15): m.box(.075, .078, .018, (.15, .11, z), "hazard", bevel=.003)
    m.box(.12, .015, .07, (0, -.135, .05), "fire", bevel=.003)
    m.box(.06, .018, .035, (0, -.146, .07), "TEAM", bevel=.003)


def bld_observatory(m: Model):
    # Deep Space Array: multiple unmistakable radio dishes aimed beyond the horizon.
    base(m, "regolith_dark")
    for x, y, r in ((-.14, .03, .085), (0, .07, .105), (.14, .03, .085)):
        m.cyl(.008, .13, (x, y, .025), "iron", seg=5)
        m.dome(r, r*.52, (x, y-.015, .15), "concrete_light", seg=8, rings=2, rz=-20, sx=1, sy=.28)
        m.cyl(.007, .085, (x, y-.035, .17), "TEAM", seg=5, ry=35)
    m.box(.13, .09, .07, (0, -.105, .025), "concrete", bevel=.008)
    m.cyl(.009, .1, (0, .07, .27), "iron", seg=5)
    m.flag(.05, .03, (0, .07, .37), "TEAM", pole_h=.035, finial=None)


def bld_castle(m: Model):
    # Bastion Dome: thick defensive ring, squat command dome, and four armored corner towers.
    base(m, "regolith_dark")
    m.cyl(.22, .09, (0, .015, .025), "concrete_dark", seg=10, r2=.21)
    m.dome(.125, .14, (0, .015, .115), "glass", seg=9, rings=3, base=.025)
    for x, y in ((-.18, -.14), (.18, -.14), (-.18, .14), (.18, .14)):
        m.cyl(.035, .17, (x, y, .025), "concrete", seg=6, r2=.029)
        m.box(.055, .05, .018, (x, y, .195), "TEAM", bevel=.003)
    m.box(.07, .025, .06, (0, -.21, .025), "hazard", bevel=.004)


def bld_aqueduct(m: Model):
    # Water Reclaimer: tank farm, pipes, and a distinctive cyan purification vessel.
    base(m, "concrete_dark")
    for x, y, r, h in ((-.15, .03, .055, .19), (0, .05, .075, .25), (.15, .03, .055, .19)):
        m.cyl(r, h, (x, y, .025), "concrete_light", seg=8, r2=r*.82, bevel=.004)
        m.cyl(r*.64, .014, (x, y, .025+h), "cryo", seg=8)
    m.cyl(.012, .12, (-.08, -.09, .025), "iron", seg=5, ry=90)
    m.cyl(.012, .12, (.08, -.09, .025), "iron", seg=5, ry=90)
    for x in (-.08, .08): m.box(.022, .02, .035, (x, -.09, .13), "TEAM", bevel=.003)
    m.box(.17, .08, .05, (0, -.15, .025), "concrete", bevel=.006)


def bld_cathedral(m: Model):
    # Cathedral of Earth: memorial nave, grand stained-glass window, and twin spires.
    base(m, "hab_white")
    m.box(.22, .3, .22, (0, .015, .025), "concrete_light", bevel=.009)
    m.gable(.26, .34, .09, (0, .015, .245), "concrete_dark", over=.008, eave=.008, bevel=.003)
    m.arch_panel(.095, .14, (0, -.16, .07), "cryo", depth=.009, seg=5)
    for x in (-.15, .15):
        m.box(.045, .055, .27, (x, .02, .025), "concrete", bevel=.006)
        m.cyl(.027, .12, (x, .02, .295), "TEAM_DARK", seg=6, r2=0)
        m.cyl(.009, .025, (x, .02, .415), "gold", seg=5)
    m.box(.07, .014, .055, (0, -.175, .03), "TEAM", bevel=.003)


def bld_powerplant(m: Model):
    # Fusion Plant: turbine hall and two contained reactor cores with orange hazard bands.
    base(m, "concrete_dark")
    m.box(.3, .24, .12, (0, .02, .025), "concrete", bevel=.01)
    for x, h in ((-.105, .25), (.105, .21)):
        m.cyl(.065, h, (x, .025, .145), "iron", seg=8, r2=.052, bevel=.005)
        m.dome(.052, .045, (x, .025, .145+h), "cryo", seg=8, rings=2)
        m.box(.115, .012, .018, (x, -.04, .21), "hazard", bevel=.002)
    m.box(.11, .014, .05, (0, -.105, .03), "TEAM", bevel=.003)
    m.cyl(.008, .07, (0, .12, .145), "gold", seg=5)


def bld_stadium(m: Model):
    # Arena: oval combat-and-games bowl with a central floor and team pennants.
    base(m, "concrete_dark")
    m.cyl(.22, .045, (0, .015, .025), "concrete", seg=12, sx=1, sy=.74)
    m.cyl(.185, .07, (0, .015, .07), "hab_white", seg=12, r2=.16, sx=1, sy=.74)
    m.cyl(.13, .022, (0, .015, .14), "lichen", seg=12, sx=1, sy=.74)
    for x in (-.19, .19):
        m.box(.018, .03, .22, (x, .015, .025), "iron", bevel=.003)
        m.flag(.05, .03, (x, .015, .245), "TEAM", pole_h=.04, finial=None)
    m.box(.08, .018, .045, (0, -.17, .025), "TEAM_DARK", bevel=.003)


def bld_lighthouse(m: Model):
    # Beacon Tower: a tall red-and-white rescue beacon with luminous crown and crossbars.
    base(m, "regolith_dark")
    m.cyl(.055, .34, (0, .015, .025), "hab_white", seg=8, r2=.035)
    for z in (.07, .15, .23): m.box(.078, .012, .024, (0, -.025, z), "hazard", bevel=.003)
    m.box(.12, .085, .05, (0, .015, .365), "TEAM_DARK", bevel=.008)
    m.dome(.07, .055, (0, .015, .415), "cryo", seg=8, rings=2)
    m.cyl(.008, .055, (0, .015, .47), "gold", seg=5)
    m.box(.14, .022, .02, (0, .015, .3), "TEAM", bevel=.003)


LANDMARKS = {"bld_" + name: fn for name, fn in (
    ("temple", bld_temple), ("library", bld_library), ("market", bld_market),
    ("barracks", bld_barracks), ("harbor", bld_harbor), ("granary", bld_granary),
    ("workshop", bld_workshop), ("university", bld_university),
    ("amphitheater", bld_amphitheater), ("bank", bld_bank), ("factory", bld_factory),
    ("observatory", bld_observatory), ("castle", bld_castle), ("aqueduct", bld_aqueduct),
    ("cathedral", bld_cathedral), ("powerplant", bld_powerplant),
    ("stadium", bld_stadium), ("lighthouse", bld_lighthouse),
)}
