"""Mars colony dwellings: pods, regolith domes, and compact residential towers."""

from city_lib import Model


def pod(m, x, y, r, mat="hab_white"):
    m.dome(r, r * .72, (x, y, .008), mat, seg=8, rings=2, base=.012)
    m.box(r*.45, .012, .035, (x, y-r*.88, .012), "TEAM", bevel=.002)
    m.box(r*.35, .012, .025, (x, y+r*.65, .014), "window", bevel=.002)


def house_0_a(m: Model):
    m.box(.17, .17, .012, (0, 0, 0), "concrete", bevel=.004)
    pod(m, 0, 0, .09)
    m.box(.13, .045, .008, (0, .115, .012), "solar", bevel=.002)
    m.cyl(.004, .12, (.1, .06, .01), "iron", seg=4)


def house_0_b(m: Model):
    m.box(.17, .15, .012, (0, 0, 0), "concrete", bevel=.004)
    pod(m, -.035, 0, .067)
    pod(m, .045, .025, .052)
    m.box(.025, .02, .035, (0, -.065, .006), "concrete", bevel=.003)
    m.cyl(.005, .12, (.075, .05, .012), "iron", seg=4)


def house_1_a(m: Model):
    m.cyl(.105, .045, (0, 0, 0), "regolith", seg=8, r2=.095)
    m.dome(.073, .075, (0, 0, .045), "glass", seg=8, rings=2, base=.008)
    m.box(.028, .014, .043, (0, -.095, .008), "TEAM", bevel=.003)


def house_1_b(m: Model):
    m.cyl(.095, .05, (0, 0, 0), "regolith", seg=8, r2=.085)
    m.dome(.061, .065, (-.032, 0, .05), "hab_white", seg=8, rings=2, base=.008)
    m.dome(.052, .056, (.043, .012, .05), "glass", seg=8, rings=2, base=.008)
    m.box(.026, .015, .04, (0, -.084, .008), "TEAM", bevel=.002)


def house_2_a(m: Model):
    m.cyl(.11, .07, (0, 0, 0), "regolith_dark", seg=9, r2=.105)
    m.dome(.09, .09, (0, 0, .07), "hab_white", seg=9, rings=2, base=.01)
    for x in (-.05, 0, .05):
        m.box(.008, .14, .11, (x, 0, .073), "concrete", bevel=.002)
    m.box(.03, .014, .04, (0, -.105, .01), "TEAM", bevel=.002)


def house_2_b(m: Model):
    m.box(.2, .18, .012, (0, 0, 0), "concrete", bevel=.004)
    m.dome(.082, .07, (-.045, 0, .01), "hab_white", seg=8, rings=2, base=.012)
    m.dome(.067, .065, (.05, .02, .01), "glass", seg=8, rings=2, base=.012)
    m.box(.075, .035, .035, (0, -.025, .025), "concrete_light", bevel=.007)
    m.box(.032, .012, .04, (.01, -.055, .01), "TEAM", bevel=.002)
    m.cyl(.005, .065, (.09, .045, .012), "iron", seg=4)
    m.cyl(.005, .04, (.09, .045, .092), "iron", seg=4)


def house_3_a(m: Model):
    m.cyl(.115, .045, (0, 0, 0), "concrete", seg=9)
    for x, y, r in ((-.04, 0, .069), (.045, .025, .064), (0, -.055, .045)):
        m.dome(r, r*.9, (x, y, .045), "glass", seg=8, rings=2, base=.009)
    m.box(.04, .025, .038, (0, -.104, .006), "TEAM", bevel=.003)
    m.box(.14, .13, .012, (0, 0, 0), "concrete", bevel=.003)
    m.cyl(.004, .025, (.08, .07, .105), "iron", seg=4)


def house_3_b(m: Model):
    m.cyl(.087, .075, (0, 0, 0), "concrete_light", seg=8, r2=.08)
    m.dome(.078, .09, (0, 0, .075), "glass", seg=8, rings=2, base=.012)
    m.box(.12, .044, .01, (0, .09, .04), "solar", bevel=.002)
    m.box(.028, .02, .04, (0, -.09, .006), "TEAM", bevel=.002)


def house_4_a(m: Model):
    m.box(.12, .105, .205, (0, 0, 0), "concrete", bevel=.009)
    for z in (.045, .105, .165):
        m.box(.126, .009, .026, (0, -.054, z), "glass", bevel=.002)
    m.box(.025, .012, .19, (.043, -.059, .005), "TEAM", bevel=.002)
    m.box(.14, .12, .012, (0, 0, .205), "solar", bevel=.003)


def house_4_b(m: Model):
    m.box(.067, .075, .16, (-.037, .005, 0), "hab_white", bevel=.007)
    m.box(.062, .07, .195, (.038, .01, 0), "concrete_light", bevel=.007)
    for z in (.05, .105, .16):
        m.box(.07, .008, .022, (-.037, -.036, z), "glass", bevel=.002)
        m.box(.065, .008, .022, (.038, -.026, z), "glass", bevel=.002)
    m.box(.035, .035, .018, (0, .01, .11), "TEAM", bevel=.003)


def house_5_a(m: Model):
    m.box(.15, .12, .13, (0, 0, 0), "hab_white", bevel=.012)
    m.dome(.065, .09, (0, .015, .13), "glass", seg=8, rings=2)
    m.box(.12, .012, .055, (0, -.063, .025), "glass", bevel=.002)
    m.cyl(.012, .045, (-.045, .045, .13), "lichen", seg=5, r2=.02)
    m.box(.038, .012, .035, (.05, -.064, .008), "TEAM", bevel=.002)


def house_5_b(m: Model):
    m.box(.1, .1, .13, (0, 0, 0), "concrete_light", bevel=.01)
    m.box(.075, .075, .045, (.008, .005, .13), "glass", bevel=.008)
    m.dome(.042, .035, (.008, .005, .175), "glass", seg=7, rings=2)
    for x in (-.058, .058):
        m.box(.018, .12, .01, (x, .005, .11), "solar", bevel=.002)
    m.box(.022, .012, .14, (-.052, -.052, .008), "TEAM", bevel=.002)
    m.cyl(.01, .045, (.05, .045, .13), "lichen", seg=5, r2=.017)


HOUSES = {f"house_{era}_{variant}": fn for era, pair in enumerate(((house_0_a, house_0_b), (house_1_a, house_1_b), (house_2_a, house_2_b), (house_3_a, house_3_b), (house_4_a, house_4_b), (house_5_a, house_5_b))) for variant, fn in zip("ab", pair)}
