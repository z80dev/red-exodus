"""Mars survival props exported with the wonder-model pipeline."""
from math import sin, cos, radians
from wonders_lib import polar


def camp_barbarian(b):
    """Feral Den: a patched pressure tent, scrap windbreak and stolen fuel drums."""
    b.hexa(.31, .025, (0, 0, 0), 'sand_dark')
    # Bent, mismatched sheet-metal shelter with a dark open entrance.
    b.box((.25, .17, .035), (0, .045, .035), 'steel', rot=(0, 0, -4))
    b.box((.25, .035, .16), (0, .105, .13), 'red_dark', rot=(0, 0, -4))
    b.box((.035, .11, .12), (-.108, .02, .12), 'concrete_dark', rot=(0, 0, -4))
    b.box((.035, .11, .12), (.108, .02, .12), 'steel', rot=(0, 0, 3))
    b.box((.045, .025, .08), (0, -.01, .075), 'black')
    # Salvaged antenna and two hazard-striped fuel drums.
    b.cyl(.008, .19, (-.16, .11, .025), 'steel', segs=5)
    b.tube([(-.16, .11, .19), (-.16, .11, .25)], [.018, .002], 'hazard', segs=4)
    for x, y in ((-.21, -.12), (.20, .10)):
        b.cyl(.038, .10, (x, y, .025), 'red_dark', segs=8)
        b.cyl(.04, .012, (x, y, .03), 'hazard', segs=8)
        b.cyl(.04, .01, (x, y, .105), 'steel', segs=8)
    b.box((.10, .045, .025), (.18, -.12, .025), 'wood_dark', rot=(0, 0, 18))


def ruin_ancient(b):
    """Crash Site: half-buried pre-war rover, broken lander struts and a dead mast."""
    b.hexa(.34, .035, (0, 0, 0), 'sand_dark')
    # Dust berm overlaps the wreck lower hull to sell a long-abandoned impact site.
    b.ico(.21, (0, .02, .065), 'sandstone_dark', 1, .08, 13, scale=(1.25, .7, .4))
    b.box((.28, .16, .10), (0, 0, .09), 'concrete_dark', rot=(3, -8, -8), bevel=.012)
    b.box((.19, .125, .075), (.015, -.012, .15), 'steel', rot=(0, -9, -8), bevel=.008)
    b.box((.105, .11, .07), (-.025, -.092, .17), 'glass_dark', rot=(0, -9, -8))
    # Crushed solar wing and exposed, snapped wheel/leg assemblies.
    b.box((.27, .012, .095), (-.19, .05, .14), 'solar', rot=(0, 16, -18))
    for x in (-.12, .12):
        b.cyl(.046, .026, (x, -.012, .045), 'black', segs=8, rot=(90, 0, 0))
        b.tube([(x, 0, .07), (x * 1.3, -.03, .02)], [.013, .009], 'steel', segs=5)
    b.tube([(.07, .03, .19), (.14, .04, .31), (.11, .05, .38)], [.012, .009, .003], 'steel', segs=5)
    b.box((.13, .014, .018), (.11, .04, .34), 'black', rot=(0, 0, 18))
    b.box((.10, .02, .018), (-.21, -.10, .045), 'hazard', rot=(0, 0, 28))


def drop_pod(b):
    """Orbital capsule, scorched heat shield, retro nozzles and four landing fins."""
    # Base footprint and blunt-bottom capsule are deliberately centred at ground level.
    b.cyl(.092, .035, (0, 0, .005), 'black', segs=10)
    b.cyl(.075, .195, (0, 0, .03), 'rocket_white', segs=10, r2=.045)
    b.cyl(.078, .025, (0, 0, .035), 'red_dark', segs=10)
    b.cyl(.047, .022, (0, 0, .225), 'steel', segs=10)
    b.dome(.046, .074, (0, 0, .238), 'red_dark', segs=10, rings=4, tip=.008)
    # Four chunky canted fins around the lower shell.
    for a in (45, 135, 225, 315):
        r = radians(a)
        x, y = cos(r), sin(r)
        b.box((.07, .018, .105), (x * .078, y * .078, .057), 'hazard', rot=(0, 0, a))
        # soot-dark retro nozzle and orange exhaust bell below each fin.
        b.cyl(.023, .047, (x * .035, y * .035, .005), 'steel', segs=6, r2=.012)
    # Compact status strip and scorch streaks.
    b.box((.012, .004, .045), (-.026, -.071, .085), 'black', rot=(0, 0, -10))


def _hab(b, x, y, z, w=.18, d=.14, h=.16, roof_solar=True):
    """Compact pressure pod with a hatch, lit glazing, airlock pipe and rooftop collector."""
    b.box((w, d, h), (x, y, z), 'white_plaster', bevel=.008)
    b.box((w * .45, .008, h * .40), (x, y - d / 2 - .005, z + h * .42), 'EMISSIVE_CYAN')
    b.box((w * .24, .012, h * .48), (x + w * .31, y - d / 2 - .006, z + h * .08), 'red_dark')
    b.tube([(x - w * .48, y, z + h * .35), (x - w * .62, y, z + h * .35),
            (x - w * .62, y, z + h * .04)], [.009, .008, .005], 'steel', segs=4)
    if roof_solar:
        b.box((w * .72, d * .56, .012), (x, y + d * .06, z + h), 'solar')
        b.box((w * .72, .008, .012), (x, y + d * .06, z + h + .012), 'steel')
    b.cyl(.007, .09, (x - w * .25, y, z + h), 'steel', segs=4)
    b.sphere(.012, (x - w * .25, y, z + h + .09), 'EMISSIVE_CYAN', segs=5, rings=3)


def _rover(b, x, y, z=.04, s=1.0):
    """Six-wheel service rover with a glass cab, hazard nose and short radio mast."""
    b.box((.12 * s, .085 * s, .045 * s), (x, y, z + .015 * s), 'steel')
    b.box((.07 * s, .062 * s, .055 * s), (x, y + .01 * s, z + .060 * s), 'glass_dark')
    b.box((.09 * s, .015 * s, .018 * s), (x, y - .046 * s, z + .025 * s), 'hazard')
    for dx in (-.043, 0, .043):
        for side in (-1, 1):
            b.cyl(.022 * s, .012 * s, (x + dx * s, y + side * .043 * s, z),
                  'black', segs=6, rot=(90, 0, 0))
    b.cyl(.004 * s, .07 * s, (x + .025 * s, y + .01 * s, z + .115 * s), 'steel', segs=4)
    b.sphere(.008 * s, (x + .025 * s, y + .01 * s, z + .185 * s), 'EMISSIVE_CYAN', segs=5, rings=3)


def solar_henge(b):
    """Twelve receiver-mirrors ring a solar-furnace core."""
    b.base_hex(.8, .03, mat='sand', rim='basalt')
    b.cyl(.16, .19, (0, 0, .04), 'basalt', segs=10, r2=.12)
    b.cyl(.12, .025, (0, 0, .23), 'hazard', segs=10)
    for a in range(0, 360, 30):
        r = radians(a)
        x, y = cos(r) * .48, sin(r) * .48
        b.box((.018, .018, .20), (x, y, .04), 'steel', rot=(0, 0, a))
        b.box((.16, .012, .19), (x, y, .235), 'solar', rot=(12, 0, a))
        b.box((.028, .02, .022), (x, y, .35), 'hazard', rot=(0, 0, a))
    b.cyl(.035, .07, (0, 0, .255), 'black', segs=8)
    b.sphere(.027, (0, 0, .40), 'EMISSIVE', segs=6, rings=3)


def beacon_colossus(b):
    """A bipedal rescue automaton, repurposed as the settlement's long-range beacon."""
    b.base_hex(.72, .03, mat='paving', rim='basalt')
    b.box((.36, .22, .09), (0, 0, .04), 'steel', bevel=.014)
    for x in (-.13, .13):
        b.box((.105, .12, .12), (x, 0, .13), 'basalt')
        b.tube([(x, 0, .20), (x * .92, 0, .38)], [.048, .035], 'steel', segs=6)
        b.box((.10, .14, .035), (x * .92, -.01, .36), 'hazard')
    b.box((.24, .17, .24), (0, 0, .48), 'red_dark', bevel=.025)
    b.box((.18, .19, .07), (0, -.01, .49), 'steel')
    b.box((.16, .018, .055), (0, -.105, .51), 'glass_dark')
    b.sphere(.025, (0, -.117, .51), 'EMISSIVE', segs=6, rings=3)
    b.cyl(.045, .035, (0, 0, .615), 'hazard', segs=8)
    b.cyl(.014, .16, (0, 0, .65), 'steel', segs=6)
    b.sphere(.042, (0, 0, .81), 'EMISSIVE', segs=6, rings=3)
    for x in (-1, 1):
        b.tube([(x * .16, 0, .52), (x * .24, -.01, .37), (x * .22, -.035, .30)],
               [.035, .025, .016], 'steel', segs=5)
        b.box((.11, .11, .055), (x * .22, -.035, .27), 'red_dark')
    for x in (-.43, .43):
        _hab(b, x, .20, .04, w=.15, d=.13, h=.12)
    _rover(b, .40, -.34, .04, .9)
    b.box((.34, .012, .014), (0, -.38, .04), 'hazard')
    b.box((.24, .012, .014), (0, .38, .04), 'steel')


def earth_library(b):
    """A buried, pressure-sealed archive capsule with visible stacks and a glass crown."""
    b.base_hex(.76, .03, mat='basalt', rim='steel')
    b.box((.62, .42, .09), (0, .02, .045), 'concrete_dark', bevel=.025)
    b.box((.52, .34, .23), (0, .02, .13), 'white_plaster', bevel=.03)
    for y in (-.085, 0, .085):
        for x in (-.12, 0, .12):
            b.box((.065, .12, .12), (x, y - .065, .16), 'gold')
    b.box((.52, .30, .035), (0, .02, .36), 'steel')
    b.dome(.27, .25, (0, .02, .395), 'glass', segs=12, rings=5)
    b.cyl(.016, .16, (0, .02, .63), 'hazard', segs=6)
    for x in (-.35, .35):
        b.box((.10, .40, .14), (x, .02, .055), 'red_dark')
        b.box((.04, .04, .04), (x, -.20, .20), 'glass_dark')
    for x in (-.55, .55):
        _hab(b, x, -.13, .04, w=.14, d=.12, h=.12)
    for x in (-.18, -.06, .06, .18):
        b.box((.035, .13, .14), (x, -.09, .17), 'gold')
        b.box((.015, .15, .01), (x, -.10, .31), 'steel')
    b.box((.26, .045, .06), (0, -.32, .04), 'steel')
    b.box((.20, .012, .025), (0, -.35, .10), 'hazard')
    _rover(b, .34, -.38, .04, .85)


def deep_ear(b):
    """A focused radio telescope array keeps listening for Earth's carrier signal."""
    b.base_hex(.76, .03, mat='basalt', rim='steel')
    for x, y, s in ((-.40, .16, .8), (.38, .19, 1.0), (-.05, -.36, 1.2)):
        b.tube([(x, y, .04), (x, y, .24 * s)], [.018, .011], 'steel', segs=5)
        b.tube([(x, y, .12), (x - .06, y, .27 * s)], [.012, .008], 'steel', segs=4)
        b.dome(.19 * s, .065 * s, (x, y, .26 * s), 'solar', segs=10, rings=3,
               rot=(18, -24, 0))
        b.cyl(.014, .10, (x, y, .30 * s), 'hazard', segs=5)
    b.cyl(.10, .10, (0, .05, .04), 'concrete_dark', segs=8)
    b.cyl(.065, .12, (0, .05, .14), 'steel', segs=8)
    b.tube([(0, .05, .25), (0, .05, .58), (.01, .05, .63)], [.016, .008, .002], 'steel', segs=4)
    b.sphere(.025, (.01, .05, .63), 'EMISSIVE_CYAN', segs=6, rings=3)
    for x in (-.54, .53):
        _hab(b, x, -.22, .04, w=.14, d=.12, h=.11)
    _rover(b, .33, -.48, .04, .8)
    for x in (-.48, .48):
        b.tube([(x, -.19, .18), (0, .05, .40)], [.005, .003], 'steel', segs=3)


def olympus_observatory(b):
    """A polar observatory: regolith-shielded dome, star-tracker mast and twin telescopes."""
    b.base_hex(.76, .03, mat='paving', rim='basalt')
    b.cyl(.37, .15, (0, .05, .04), 'concrete_dark', segs=10)
    b.dome(.36, .29, (0, .05, .19), 'white_plaster', segs=12, rings=5)
    b.box((.11, .045, .27), (0, -.305, .05), 'steel')
    b.box((.13, .02, .035), (0, -.312, .31), 'solar')
    for x in (-.39, .39):
        b.cyl(.085, .09, (x, .05, .04), 'basalt', segs=8)
        b.tube([(x, .05, .12), (x * .8, .05, .43)], [.029, .025], 'steel', segs=6)
        b.cyl(.044, .20, (x * .8, .05, .40), 'glass_dark', segs=8, rot=(0, 70, 0))
        b.cyl(.05, .025, (x * .8, .05, .54), 'hazard', segs=8)
    for x in (-.52, .52):
        _hab(b, x, .20, .04, w=.16, d=.13, h=.12)
    _rover(b, .34, -.40, .04, .85)
    for a in (45, 135, 225, 315):
        r = radians(a)
        b.box((.18, .11, .012), (cos(r) * .49, sin(r) * .49, .04), 'solar',
              rot=(0, 0, a))
    b.cyl(.018, .18, (0, .05, .41), 'red_dark', segs=6)
    b.sphere(.027, (0, .05, .60), 'EMISSIVE', segs=6, rings=3)


def space_elevator(b):
    """Regolith anchor with a narrow, tapering carbon-fibre tether above ordinary roof height."""
    b.base_hex(.78, .03, mat='basalt', rim='steel')
    b.cyl(.30, .16, (0, 0, .04), 'concrete_dark', segs=10, r2=.20)
    for a in (0, 90, 180, 270):
        r = radians(a)
        b.box((.12, .06, .15), (cos(r) * .25, sin(r) * .25, .04), 'hazard', rot=(0, 0, a))
    b.cyl(.11, .23, (0, 0, .20), 'steel', segs=8, r2=.055)
    b.box((.018, .02, .81), (0, .012, .34), 'solar')
    b.box((.045, .045, .04), (0, 0, .36), 'red_dark')
    b.tube([(0, 0, .34), (0, 0, .67), (.006, 0, .98), (0, 0, 1.15)],
           [.025, .014, .006, .0015], 'hazard', segs=4)
    b.sphere(.028, (0, 0, 1.13), 'EMISSIVE', segs=6, rings=3)
    for x in (-.52, .52):
        _hab(b, x, .18, .04, w=.17, d=.14, h=.13)
        b.tube([(x, .12, .18), (x * .5, .02, .37)], [.012, .005], 'steel', segs=4)
    _rover(b, .34, -.42, .04, .9)
    for a in (45, 135, 225, 315):
        r = radians(a)
        b.box((.17, .11, .012), (cos(r) * .51, sin(r) * .51, .04), 'solar',
              rot=(0, 0, a))


def jezero_delta(b):
    """Braided mineral channels converge through the ancient river delta."""
    b.base_hex(.8, .03, mat='sand', rim='basalt')
    b.box((.15, .68, .016), (0, -.01, .035), 'WATER', rot=(0, 0, -12))
    for x, y, angle in ((-.26, .16, 25), (.25, .19, -26), (-.33, -.15, -48), (.30, -.20, 48)):
        b.box((.12, .34, .012), (x, y, .04), 'WATER', rot=(0, 0, angle))
        b.box((.025, .37, .025), (x + .09, y, .035), 'stone_dark', rot=(0, 0, angle))
    for x, y in ((-.48, -.35), (.45, -.34), (-.48, .37), (.47, .35), (0, .46)):
        b.ico(.075, (x, y, .055), 'foliage', 1, .15, int((x + y + 1) * 99), scale=(1.3, .8, .35))
    for x, y in ((-.55, 0), (.54, .02), (-.18, -.42), (.18, .42)):
        b.ico(.045, (x, y, .04), 'basalt', 1, .12, int((x + y + 1) * 51), scale=(1.2, .9, .55))
    b.cyl(.006, .37, (0, 0, .055), 'hazard', segs=4)


def face_of_cydonia(b):
    """Wind-cut escarpment with a face-like cliff, not fossil bones."""
    b.base_hex(.8, .03, mat='sand', rim='basalt')
    b.box((.70, .28, .25), (0, .12, .04), 'sandstone_dark', rot=(0, -8, 0), bevel=.018)
    b.box((.58, .24, .19), (0, -.015, .13), 'sandstone', rot=(0, -7, 0), bevel=.018)
    b.box((.40, .20, .15), (0, -.055, .26), 'limestone', rot=(0, -5, 0), bevel=.018)
    b.box((.26, .06, .12), (0, -.17, .24), 'sandstone_dark', rot=(0, -5, 0))
    for x in (-.115, .115):
        b.ico(.042, (x, -.169, .315), 'basalt', 1, .05, int((x + .3) * 100),
              scale=(1, .3, .55))
        b.ico(.012, (x, -.184, .32), 'gold', 0, .02, int((x + .3) * 100))
    b.box((.045, .075, .11), (0, -.19, .25), 'limestone', rot=(0, 8, 0))
    b.box((.17, .04, .025), (0, -.194, .18), 'basalt', rot=(0, 3, 0))
    b.box((.38, .045, .018), (0, -.12, .40), 'sand_dark')


def sintered_citadel(b):
    """Stepped regolith radiation bunker with armored doors and a communications mast."""
    b.base_hex(.8, .03, mat='sand', rim='basalt')
    b.box((.60, .44, .14), (0, .04, .04), 'basalt', bevel=.018)
    b.box((.49, .37, .14), (0, .04, .18), 'concrete_dark', bevel=.014)
    b.box((.37, .29, .13), (0, .04, .32), 'sandstone_dark', bevel=.012)
    b.box((.22, .18, .15), (0, .04, .45), 'steel', bevel=.012)
    b.box((.16, .016, .115), (0, -.057, .46), 'red_dark')
    b.box((.045, .02, .055), (0, -.07, .48), 'hazard')
    for x in (-.18, .18):
        b.box((.045, .025, .06), (x, -.15, .33), 'hazard')
        b.box((.20, .12, .025), (x, .12, .45), 'solar')
    b.cyl(.012, .18, (0, .04, .60), 'steel', segs=5)
    b.tube([(0, .04, .76), (.05, .04, .81)], [.014, .001], 'hazard', segs=4)
    for x in (-.44, .44):
        _hab(b, x, .20, .04, w=.16, d=.14, h=.13)
        b.tube([(x * .7, .10, .10), (x, .16, .22)], [.01, .006], 'steel', segs=4)
    _rover(b, .38, -.35, .04, .9)
    b.box((.42, .09, .014), (0, -.31, .04), 'hazard')
    for x in (-.26, .26):
        b.cyl(.026, .12, (x, .16, .54), 'steel', segs=6)
        b.sphere(.018, (x, .16, .68), 'EMISSIVE_CYAN', segs=5, rings=3)


def hanging_greenhouses(b):
    """Glowing pressure-glass gardens clamped to a cliff of red regolith."""
    b.base_hex(.8, .03, mat='basalt', rim='stone_dark')
    b.box((.54, .26, .25), (0, .22, .04), 'sandstone_dark', bevel=.025)
    b.box((.45, .23, .17), (0, .17, .27), 'concrete_dark', bevel=.02)
    b.box((.36, .21, .14), (0, .11, .44), 'basalt', bevel=.018)
    for z, xoff in ((.10, -.28), (.29, .27), (.46, -.23)):
        b.tube([(xoff * 1.4, -.02, z), (xoff * .9, .04, z + .12)], [.016, .012], 'steel', segs=4)
        b.dome(.16, .12, (xoff, -.015, z + .03), 'glass', segs=10, rings=4)
        b.box((.11, .10, .012), (xoff, -.015, z + .045), 'interior_foliage')
        b.ico(.025, (xoff, -.015, z + .09), 'interior_foliage', 1, .08, int((z + 1) * 30))
    b.tube([(-.56, .10, .07), (-.5, .1, .62), (-.4, .1, .72)], [.014, .01, .002], 'hazard', segs=4)


def storm_wall(b):
    """A sinuous dust baffle with turbine fins, independent of terrestrial fortifications."""
    b.base_hex(.8, .03, mat='sand', rim='basalt')
    for i in range(9):
        x = -.64 + i * .16
        y = .06 + .09 * cos(i * .65)
        angle = -16 + i * 4
        h = .25 + .05 * (i % 3)
        b.box((.15, .055, h), (x, y, .04), 'concrete_dark', rot=(0, 0, angle), bevel=.008)
        b.box((.12, .018, .045), (x, y - .034, .13), 'hazard', rot=(0, 0, angle))
        b.cyl(.018, .12, (x, y + .015, .04 + h), 'steel', segs=5)
        b.torus(.073, .009, (x, y + .015, .16 + h), 'solar', segs=8, rsegs=3,
                rot=(0, 60 + i * 5, 0))
    b.box((.30, .035, .06), (0, .12, .35), 'steel')


def dome_remembrance(b):
    """A ribbed pressure-dome memorial surrounds the last hologram of Earth."""
    b.base_hex(.8, .03, mat='basalt', rim='steel')
    b.cyl(.42, .20, (0, .02, .04), 'concrete_dark', segs=12, r2=.35)
    b.dome(.34, .34, (0, .02, .24), 'white_plaster', segs=12, rings=6)
    for a in range(0, 360, 30):
        r = radians(a)
        points = [(cos(r) * .34 * cos(t), .02 + sin(r) * .34 * cos(t), .24 + .34 * sin(t))
                  for t in (0, .45, .9, 1.35, 1.5708)]
        b.tube(points, [.012, .01, .009, .007, .002], 'steel', segs=4)
    b.sphere(.095, (0, -.07, .56), 'cryo', segs=10, rings=6)
    b.torus(.12, .007, (0, -.07, .56), 'hazard', segs=12, rsegs=3, rot=(0, 90, 0))
    b.box((.12, .014, .055), (0, -.075, .30), 'black')


def lava_tube_temple_city(b):
    """A collapsed skylight opens onto descending hab terraces inside a lava tube."""
    b.base_hex(.8, .03, mat='basalt', rim='stone_dark')
    b.cyl(.61, .10, (0, 0, .035), 'sandstone_dark', segs=12, r2=.56)
    b.torus(.48, .075, (0, 0, .10), 'rock_dark', segs=14, rsegs=4)
    b.torus(.34, .055, (0, 0, .13), 'basalt', segs=14, rsegs=4)
    b.torus(.20, .04, (0, 0, .16), 'steel', segs=12, rsegs=4)
    b.cyl(.16, .015, (0, 0, .14), 'black', segs=12)
    b.cyl(.075, .10, (0, 0, .15), 'EMISSIVE', segs=10)
    b.cyl(.014, .27, (0, 0, .25), 'hazard', segs=6)
    for a in range(0, 360, 45):
        r = radians(a)
        x, y = .47 * cos(r), .47 * sin(r)
        b.box((.10, .10, .16), (x, y, .10), 'concrete_dark', rot=(0, 0, a))
        b.box((.08, .015, .06), (x, y - .055, .14), 'glass_dark', rot=(0, 0, a))


def monument_lost(b):
    """A name-carved obelisk is ringed by empty cryo helmets, one for each missing colony."""
    b.base_hex(.77, .03, mat='basalt', rim='steel')
    b.cyl(.26, .12, (0, .02, .04), 'concrete_dark', segs=10)
    b.box((.17, .15, .55), (0, .02, .16), 'steel', taper=.68)
    b.cone(.08, .10, (0, .02, .71), 'cryo', segs=6)
    b.box((.025, .015, .43), (0, -.06, .20), 'hazard')
    for a in range(0, 360, 45):
        x, y, _ = polar(.46, a)
        b.cyl(.018, .09, (x, y, .04), 'red_dark', segs=5)
        b.sphere(.055, (x, y, .15), 'steel', segs=8, rings=4)
        b.box((.045, .012, .018), (x, y - .045, .14), 'black')


def tilted_spire(b):
    """A lightweight tower leans against a long counterweight boom."""
    b.base_hex(.78, .03, mat='paving', rim='basalt')
    b.box((.38, .29, .12), (0, .02, .04), 'concrete_dark')
    b.box((.14, .14, .72), (-.04, .02, .14), 'steel', rot=(0, -14, -4), taper=.72)
    b.box((.055, .06, .12), (.015, .02, .75), 'hazard', rot=(0, -14, -4))
    b.tube([(-.04, .02, .40), (.20, .04, .54), (.43, .04, .56)], [.018, .014, .008], 'steel', segs=4)
    b.box((.15, .10, .09), (.43, .04, .48), 'basalt')
    b.tube([(.43, .04, .55), (.48, .04, .84)], [.008, .004], 'cryo', segs=4)
    for x in (-.48, .48):
        _hab(b, x, .20, .04, w=.14, d=.12, h=.11)
        b.tube([(x, .12, .18), (x * .5, .03, .32)], [.008, .004], 'steel', segs=4)
    _rover(b, -.38, -.35, .04, .9)
    for z in (.32, .44, .56, .68):
        b.box((.035, .014, .018), (-.104, -.055, z), 'EMISSIVE_CYAN')
    b.tube([(-.04, .02, .74), (.18, .02, .78), (.42, .02, .78)], [.01, .006, .003], 'steel', segs=4)
    b.box((.10, .10, .055), (.43, .02, .74), 'hazard')


def clocktower_sols(b):
    """A Mars sol chronometer mast tracks Phobos and Deimos against the red sky."""
    b.base_hex(.76, .03, mat='basalt', rim='steel')
    b.cyl(.21, .15, (0, .02, .04), 'concrete_dark', segs=10, r2=.12)
    b.box((.10, .10, .52), (0, .02, .19), 'steel')
    b.box((.28, .03, .23), (0, -.055, .42), 'red_dark')
    b.box((.22, .012, .18), (0, -.076, .44), 'clock')
    b.box((.012, .008, .08), (0, -.085, .46), 'black')
    b.box((.07, .008, .012), (0, -.086, .49), 'black', rot=(0, 0, -24))
    b.torus(.13, .007, (0, .02, .77), 'steel', segs=10, rsegs=3, rot=(18, 0, 0))
    for x, y, z, r in ((-.13, .02, .77, .045), (.12, .02, .77, .025)):
        b.sphere(r, (x, y, z), 'cryo' if r > .03 else 'hazard', segs=6, rings=3)
    b.cyl(.009, .13, (0, .02, .71), 'hazard', segs=4)
    for x in (-.45, .45):
        _hab(b, x, .20, .04, w=.15, d=.12, h=.11)
    _rover(b, .38, -.38, .04, .9)
    for x in (-.30, .30):
        b.box((.18, .12, .012), (x, .24, .04), 'solar', rot=(0, 0, -12 if x < 0 else 12))
    for z in (.45, .51, .57):
        b.box((.035, .012, .012), (-.065, -.09, z), 'hazard')


def skyhook_pylon(b):
    """Four-legged lattice pylon anchors the carbon ribbon of an orbital skyhook."""
    b.base_hex(.78, .03, mat='basalt', rim='steel')
    corners = [(-.22, -.20), (.22, -.20), (.22, .20), (-.22, .20)]
    for (x, y) in corners:
        b.tube([(x, y, .05), (x * .72, y * .72, .82)], [.022, .009], 'steel', segs=4)
    for i in range(4):
        x, y = corners[i]
        x2, y2 = corners[(i + 1) % 4]
        b.tube([(x, y, .30), (x2 * .72, y2 * .72, .55)], [.009, .006], 'hazard', segs=4)
        b.tube([(x, y, .58), (x2 * .72, y2 * .72, .30)], [.009, .006], 'steel', segs=4)
    b.box((.12, .12, .11), (0, 0, .82), 'red_dark')
    b.tube([(0, 0, .90), (0, 0, 1.07), (.005, 0, 1.17)], [.025, .009, .0015], 'solar', segs=4)
    b.sphere(.024, (0, 0, 1.15), 'cryo', segs=6, rings=3)


def statue_tomorrow(b):
    """An EVA worker raises a signal flare over a field of red dunes."""
    b.base_hex(.73, .03, mat='sand', rim='basalt')
    b.cyl(.20, .10, (0, .03, .04), 'concrete_dark', segs=10)
    b.box((.11, .11, .19), (-.045, .015, .13), 'steel')
    b.box((.10, .10, .18), (.055, .015, .13), 'steel')
    b.box((.20, .16, .25), (0, .015, .30), 'white_plaster', bevel=.025)
    b.box((.14, .05, .17), (0, -.075, .32), 'glass_dark')
    b.sphere(.10, (0, -.005, .56), 'steel', segs=8, rings=5)
    b.sphere(.071, (0, -.085, .56), 'glass_dark', segs=8, rings=5, scale=(1, .32, .75))
    b.box((.16, .08, .15), (0, .095, .32), 'red_dark')
    b.tube([(.09, .01, .43), (.17, -.015, .59), (.23, -.03, .74), (.22, -.03, .79)],
           [.04, .032, .021, .014], 'white_plaster', segs=5)
    b.tube([(-.09, .02, .42), (-.18, -.02, .50), (-.21, -.02, .62)], [.04, .03, .018], 'steel', segs=5)
    b.cyl(.014, .09, (.22, -.03, .79), 'hazard', segs=5)
    b.sphere(.04, (.22, -.03, .90), 'EMISSIVE', segs=6, rings=3)
    b.box((.13, .12, .14), (0, .11, .34), 'red_dark')
    b.box((.06, .014, .09), (0, -.092, .35), 'EMISSIVE_CYAN')
    b.torus(.104, .008, (0, -.005, .56), 'hazard', segs=8, rsegs=3, rot=(90, 0, 0))
    _rover(b, .38, -.34, .04, .9)
    b.box((.30, .09, .014), (0, -.38, .04), 'steel')
    for x in (-.52, .52):
        b.cyl(.012, .12, (x, .10, .04), 'steel', segs=5)
        b.sphere(.028, (x, .10, .18), 'EMISSIVE_CYAN', segs=6, rings=3)


def biodome_opera(b):
    """Several illuminated glass shells enclose a crater-edge performance hall."""
    b.base_hex(.79, .03, mat='basalt', rim='steel')
    b.torus(.50, .055, (0, 0, .04), 'sandstone_dark', segs=12, rsegs=4)
    b.cyl(.38, .10, (0, 0, .04), 'black', segs=12)
    b.box((.30, .18, .08), (0, -.02, .12), 'steel')
    b.box((.22, .02, .08), (0, -.115, .13), 'hazard')
    for x, y, r, h in ((-.26, .11, .21, .23), (.26, .11, .21, .23), (0, .25, .25, .30)):
        b.dome(r, h, (x, y, .16), 'glass', segs=10, rings=5)
        b.box((.07, .035, .02), (x, y, .18), 'interior_foliage')
        b.sphere(.018, (x, y, .23), 'EMISSIVE', segs=5, rings=3)


def guardian_mars(b):
    """A colossal helmeted EVA guardian holds open arms over a crater valley."""
    b.base_hex(.8, .03, mat='basalt', rim='stone_dark')
    b.cyl(.48, .12, (0, .02, .04), 'sandstone_dark', segs=10, r2=.35)
    b.box((.13, .14, .18), (-.055, 0, .16), 'steel')
    b.box((.12, .14, .18), (.055, 0, .16), 'steel')
    b.box((.29, .20, .30), (0, 0, .32), 'white_plaster', bevel=.028)
    b.box((.18, .03, .16), (0, -.11, .36), 'glass_dark')
    b.sphere(.125, (0, 0, .64), 'steel', segs=10, rings=6)
    b.sphere(.083, (0, -.10, .64), 'glass_dark', segs=8, rings=5, scale=(1, .32, .8))
    for side in (-1, 1):
        b.tube([(side * .14, 0, .46), (side * .28, 0, .53), (side * .43, -.01, .61),
                (side * .56, -.01, .65)], [.065, .05, .035, .028], 'white_plaster', segs=5)
        b.sphere(.044, (side * .57, -.01, .65), 'steel', segs=6, rings=3)
        b.box((.11, .13, .06), (side * .56, -.02, .60), 'hazard')
    b.box((.06, .09, .12), (0, .12, .34), 'red_dark')


MARS_REDESIGNS = {
    'w_pyramids': (sintered_citadel, {}),
    'w_stonehenge': (solar_henge, {}),
    'w_hanging_gardens': (hanging_greenhouses, {}),
    'w_colossus': (beacon_colossus, {}),
    'w_great_library': (earth_library, {}),
    'w_oracle': (deep_ear, {}),
    'w_great_wall': (storm_wall, {}),
    'w_hagia_sophia': (dome_remembrance, {}),
    'w_angkor_wat': (lava_tube_temple_city, {}),
    'w_taj_mahal': (monument_lost, {}),
    'w_leaning_tower': (tilted_spire, {}),
    'w_himeji': (olympus_observatory, {}),
    'w_big_ben': (clocktower_sols, {}),
    'w_eiffel': (skyhook_pylon, {'max_radius': .85, 'height': (.4, 1.2)}),
    'w_liberty': (statue_tomorrow, {'max_radius': .85, 'height': (.4, .95)}),
    'w_opera_house': (biodome_opera, {}),
    'w_cristo': (guardian_mars, {}),
    'w_launch_pad': (space_elevator, {'max_radius': .85, 'height': (.4, 1.2)}),
    'nw_elder_tree': (jezero_delta, {}),
    'nw_titan_bones': (face_of_cydonia, {}),
}


MODELS = {
    'camp_barbarian': (camp_barbarian, {'max_radius': .85, 'height': (.1, .4)}),
    'ruin_ancient': (ruin_ancient, {'max_radius': .85, 'height': (.3, .48)}),
    'drop_pod': (drop_pod, {'max_radius': .2, 'height': (.3, .4)}),
}
MODELS.update(MARS_REDESIGNS)
