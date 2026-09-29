"""Generate RED EXODUS nature props, Mars resources and installations.

/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python art/blender/nature_build.py
Optional arguments after --: --only key [key ...], --preview-only.
Deterministic geometry, baked triangulation, strict budgets and GLB re-import
checks are part of generation. Contact sheets use presentation-only plinths.
"""
import sys
from pathlib import Path
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from nature_lib import *

NATURE = 'tree_pine tree_broadleaf tree_palm tree_jungle tree_snowpine bush reeds cactus rock_small rock_large mountain_a mountain_b mountain_c mountain_snow hill_rocks ice_floe reef_coral flowers'.split()
RESOURCES = 'wheat rice cattle sheep deer fish stone bananas gold gems silk spices wine incense furs pearls marble ivory dyes cotton sugar whales horses iron niter coal oil'.split()
IMPROVEMENTS = 'farm mine pasture plantation lumbermill quarry fishing_boats camp trading_post oil_well'.split()
MISC = ['road_marker']

def pine(snow=False):
    cone((0,0,.10),.025,.20,'trunk',6,top=.019)
    for i,(z,r,h) in enumerate([(.205,.125,.20),(.285,.098,.185),(.355,.07,.17)]):
        cone((0,0,z),r,h,['leaf_dark','leaf','leaf_light'][i],7)
        if snow:
            cone((0,0,z+h*.14),r*.73,h*.73,'snow',7)

def broadleaf(jungle=False):
    beam((0,0,0),(.014,.006,.23),.023,'trunk',6,end=.017)
    beam((0,0,.12),(-.065,0,.23),.014,'trunk',5,end=.009)
    crowns=[((-.065,0,.265),(.10,.09,.09),'leaf'),((.05,.016,.28),(.12,.10,.115),'leaf_dark'),((0,-.01,.335),(.105,.095,.105),'leaf_light')]
    for pos,size,color in crowns:
        ico(pos,size,color)
    if jungle:
        blade((0,0,.21),(.15,-.05,.28),.07,'leaf_dark')
        blade((0,0,.18),(-.14,.06,.27),.07,'leaf')

def palm(banana=False):
    ring_mesh('Leaning ringed trunk',[(0,.024,0,0,0),(.12,.02,.018,0,.1),(.25,.018,.05,0,0),(.32,.02,.045,0,.1)],'trunk',6)
    for i in range(6):
        a=i*math.tau/6
        blade((.045,0,.32),(.045+.18*math.cos(a),.18*math.sin(a),.285),.065 if banana else .046,'leaf_light' if i%2 else 'leaf',.052)
    if banana:
        beam((.045,0,.25),(.045,-.12,.25),.008,'trunk',5)
        for i in range(4):
            x=.018+i*.019
            beam((x,-.12,.25),(x+.006,-.14,.20),.015,'gold',5)
            beam((x+.006,-.14,.20),(x+.009,-.12,.18),.013,'gold',5,end=.005)
    else:
        ico((.044,-.018,.30),(.032,.026,.03),'trunk')

def rock(pos=(0,0,.07),size=(.13,.10,.09),color='rock'):
    obj=ico(pos,size,color)
    # Cut the natural boulder at ground without adding hidden geometry.
    for v in obj.data.vertices:
        if v.co.z*size[2]+pos[2]<0:
            v.co.z=-pos[2]/size[2]
    return obj

def knoll(x,y,rx,ry,h,color='leaf'):
    """Low convex grassy landform, with a scalloped rather than spherical edge."""
    n=12
    verts=[]
    for z,r in [(0,1),(.30*h,.88),(.78*h,.53),(h,.14)]:
        for i in range(n):
            a=i*math.tau/n
            uneven=1+.055*math.sin(i*3.1)
            verts.append((x+rx*r*math.cos(a)*uneven,y+ry*r*math.sin(a)*uneven,z))
    faces=[tuple(range(n-1,-1,-1))]
    for row in range(3):
        for i in range(n):
            a=row*n+i; b=row*n+(i+1)%n
            faces.append((a,b,b+n,a+n))
    faces.append(tuple(3*n+i for i in range(n)))
    obj=mesh('Rolling grassy foothill',verts,faces,color)
    obj.data.materials.append(mat('leaf_light' if color.startswith('leaf') else ('snow' if color=='snow' else 'rock')))
    obj.data.materials.append(mat('leaf_dark' if color.startswith('leaf') else ('water' if color=='snow' else 'rock_dark')))
    for polygon in obj.data.polygons:
        polygon.material_index=2 if polygon.index<13 else (1 if polygon.index%6==0 else 0)
    return obj

def massif_shell(rings, material, name):
    """Low-poly closed shell from (height, radius, center-x, center-y) rings."""
    n=12
    verts=[]
    for z,r,x,y in rings:
        for i in range(n):
            a=i*math.tau/n
            jitter=1+.035*math.sin(i*4.1)
            verts.append((x+r*jitter*math.cos(a),y+r*jitter*math.sin(a),z))
    faces=[tuple(range(n-1,-1,-1))]
    for row in range(len(rings)-1):
        for i in range(n):
            a=row*n+i; b=row*n+(i+1)%n
            faces.append((a,b,b+n,a+n))
    faces.append(tuple((len(rings)-1)*n+i for i in range(n)))
    return mesh(name,verts,faces,material)

def mountain(variant):
    if variant=='a':  # shield volcano: broad, gently stepped lava slopes and a caldera
        massif_shell([(0,.94,0,0),(.15,.84,0,0),(.34,.66,-.02,.01),(.53,.44,-.02,.01),(.69,.30,-.02,.01)],'rust','Olympian shield volcano')
        cone((-.02,.01,.705),.27,.035,'rock_dark',12,top=.25)
        torus((-.02,.01,.724),.25,.018,'ochre')
        cone((-.02,.01,.735),.12,.022,'rock_dark',10,top=.11)
        for x,y in [(-.62,-.20),(.56,-.34),(.40,.48)]:
            cone((x,y,.08),.13,.16,'basalt',7,top=.08)
    elif variant=='b':  # mesa: broad level cap and deeply cut layered escarpment
        massif_shell([(0,.94,0,0),(.18,.82,0,0),(.43,.65,.02,0),(.57,.64,.02,0),(.62,.59,.02,0)],'rock_dark','Stratified mesa')
        massif_shell([(.36,.68,.02,0),(.405,.67,.02,0)],'ochre','Mesa iron band')
        cone((.02,0,.65),.59,.08,'rust',12,top=.55)
        cone((.02,0,.697),.48,.012,'sand',12,top=.48)
        for x,y in [(-.48,-.43),(.48,-.40),(.60,.26)]:
            rock((x,y,.055),(.18,.12,.08),'basalt')
    elif variant=='c':  # crater rim massif: broken raised rim around a sunken basin
        massif_shell([(0,.94,0,0),(.13,.85,0,0),(.34,.70,0,0),(.60,.62,0,0),(.64,.51,0,0),(.31,.39,0,0)],'basalt','Crater-rim massif')
        cone((0,0,.315),.40,.018,'rock_dark',12,top=.40)
        cone((0,0,.327),.29,.008,'rust',12,top=.29)
        for i in range(8):
            a=i*math.tau/8
            rock((.60*math.cos(a),.60*math.sin(a),.42),(.13,.12,.10),'ochre' if i%2 else 'rock')
    else:  # frost-capped massif
        massif_shell([(0,.94,0,0),(.20,.78,0,0),(.45,.55,-.03,.02),(.68,.33,-.04,.02),(.81,.18,-.04,.02)],'rock_dark','Frost-flat massif')
        cone((-.04,.02,.80),.43,.22,'snow',9,top=.11)
        for x,y in [(-.30,.08),(.22,.12),(-.16,-.20)]:
            ico((x,y,.68),(.11,.075,.035),'snow')
        for x,y in [(-.55,-.25),(.50,-.40),(.56,.34)]:
            rock((x,y,.055),(.17,.12,.09),'snow')

def reeds():
    # Perchlorate salt crystals: brittle blades, not vegetation.
    for i in range(9):
        a=i*2.4; x=.12*math.cos(a); y=.11*math.sin(a); h=.11+(i%3)*.035
        cone((x,y,h/2),.018,h,'cream',5,top=.002)
        crystal(x,y,h,.06+(i%2)*.025,'snow')

def cactus():
    # Ventifact: wind-faceted basalt with a sharp, directional ridge.
    rock((0,0,.14),(.12,.095,.14),'basalt')
    cone((-.015,0,.26),.052,.19,'rust',5,top=.009)
    for x,y,h in [(-.10,-.015,.17),(.08,.035,.21),(.01,-.075,.12)]:
        beam((x,y,.025),(x+.035,y,h),.025,'rock_dark',5,end=.008)
        beam((x+.035,y,h),(x+.055,y,h+.025),.018,'ochre',5,end=.003)

def flowers():
    # Terraforming lichen deliberately reads as a living, spreading crust.
    for x,y,rx,ry,c in [(-.09,0,.105,.08,'lichen'),(.04,.025,.12,.085,'leaf_light'),(.13,-.045,.07,.065,'coral'),(-.02,-.09,.085,.06,'leaf_dark')]:
        rock((x,y,.014),(rx,ry,.018),c)
    for x,y in [(-.14,-.02),(-.06,.04),(.02,-.035),(.10,.04),(.16,-.055)]:
        for side in [-1,1]:
            blade((x,y,.025),(x+side*.026,y+.018,.048),.014,'leaf_light' if side>0 else 'leaf')
    for x,y in [(-.09,0),(.045,.025),(.13,-.045)]:
        ico((x,y,.038),(.024,.019,.009),'coral')

def nature(key):
    if key=='tree_pine':  # basalt spire
        cone((0,0,.19),.095,.38,'basalt',6,top=.014)
        cone((.012,0,.29),.047,.18,'rock_dark',5,top=.006)
        for z in [.10,.21,.32]: rock((0,-.025,z),(.08,.045,.018),'rust')
    elif key=='tree_broadleaf':  # mushroom-capped hoodoo
        cone((0,0,.14),.055,.28,'rock',7,top=.045)
        ico((0,0,.31),(.15,.13,.065),'ochre')
        ico((0,-.01,.35),(.13,.12,.045),'rust')
    elif key=='tree_palm':  # mineral geyser chimney, pale steam plume
        cone((0,0,.13),.095,.26,'basalt',7,top=.055)
        cone((0,0,.265),.07,.035,'rock_dark',8,top=.06)
        for x,y,z,s in [(-.02,0,.34,.035),(.012,.008,.40,.029),(.035,.015,.45,.020)]:
            ico((x,y,z),(s,s,s*1.5),'cream')
        torus((0,0,.11),.10,.012,'ochre')
    elif key=='tree_jungle':  # skylight in a collapsed lava tube
        cone((0,0,.075),.18,.15,'basalt',9,top=.17)
        cone((0,0,.15),.13,.035,'rock_dark',9,top=.13)
        torus((0,0,.17),.15,.025,'rust')
        ico((0,0,.13),(.09,.09,.012),'ink')
        for x,y in [(-.13,0),(.1,.07),(.02,-.14)]:
            rock((x,y,.10),(.065,.055,.06),'rock')
    elif key=='tree_snowpine':  # blue-white ice spire
        cone((0,0,.19),.09,.38,'dryice',6,top=.006)
        cone((-.015,-.01,.24),.052,.22,'snow',5,top=.004)
    elif key=='bush':
        for pos,sz,c in [((-.07,0,.055),(.09,.08,.06),'rock'),((.045,0,.07),(.10,.085,.075),'rust'),((0,.065,.05),(.075,.07,.05),'basalt')]:
            rock(pos,sz,c)
    elif key=='reeds': reeds()
    elif key=='cactus': cactus()
    elif key=='flowers': flowers()
    elif key=='rock_small':
        rock((0,0,.055),(.105,.09,.065),'rust')
        rock((.05,-.02,.035),(.06,.05,.04),'rock_dark')
    elif key=='rock_large':
        rock((-.035,.015,.12),(.22,.19,.14),'rust')
        rock((.14,-.08,.06),(.12,.10,.07),'basalt')
    elif key.startswith('mountain_'): mountain(key.split('_')[1])
    elif key=='hill_rocks':
        massif_shell([(0,.78,0,0),(.09,.70,0,0),(.20,.50,.03,0),(.25,.28,.06,.01)],'ochre','Layered sediment outcrop')
        for x,y,z,s,c in [(-.37,-.1,.09,.16,'rust'),(.24,.08,.12,.19,'rock'),(.48,-.06,.07,.12,'basalt')]:
            rock((x,y,z),(s,s*.72,s*.68),c)
        for z in [.08,.145,.20]:
            beam((-.48,.02,z),(.40,.02,z+.01),.009,'sand',4)
    elif key=='ice_floe':
        cone((0,0,.035),.34,.07,'dryice',7,top=.31)
        cone((-.035,.005,.075),.29,.035,'snow',7,top=.24)
        cone((.20,.12,.064),.12,.045,'dryice',5,top=.08)
        for x,y in [(-.16,.10),(.10,-.12)]:
            beam((x,y,.08),(x+.05,y,.085),.008,'glass',4)
    elif key=='reef_coral':
        rock((0,0,.025),(.21,.16,.035),'basalt')
        for x,y,h in [(-.12,0,.13),(0,.03,.19),(.12,0,.14),(.04,-.11,.10)]:
            crystal(x,y,.035,h,'opal')
            for side in [-1,1]:
                crystal(x+side*.035,y,.025,h*.64,'cryo')

def crop(x,y,h=.16,kind='wheat'):
    beam((x,y,0),(x,y,h),.005,'leaf' if kind=='rice' else 'gold',4)
    for j in range(3):
        z=h-.015*j
        for sign in [-1,1]:
            obj=ico((x+sign*.011,y,z),(.011,.009,.02),'cream' if kind=='rice' else 'gold')
            obj.rotation_euler[1]=sign*.48
    blade((x,y,.05),(x+.035,y,.11),.012,'leaf',0)

def animal(kind):
    coat={'cattle':'cream','sheep':'snow','deer':'earth','horses':'trunk'}[kind]
    body_z=.145
    ico((0,.025,body_z),(.075,.115,.065),coat,2 if kind=='sheep' else 1)
    for x in [-.043,.043]:
        for y in [-.045,.09]:
            beam((x,y,.025),(x,y,.14),.013,coat,5,end=.017)
            cube((x,y,.014),(.029,.031,.028),'coal')
    beam((0,-.05,.14),(0,-.11,.21),.032,coat,6,end=.037)
    ico((0,-.135,.21),(.046,.059,.043),coat)
    ico((0,-.174,.193),(.037,.03,.025),'pink' if kind=='cattle' else 'rock_dark')
    for side in [-1,1]:
        ico((side*.048,-.112,.236),(.028,.014,.012),coat)
        ico((side*.039,-.154,.224),(.006,.007,.006),'ink')
        if kind in ['cattle','deer']:
            beam((side*.029,-.12,.24),(side*.049,-.09,.285),.009,'cream',5,end=.003)
            if kind=='deer':
                beam((side*.049,-.09,.28),(side*.061,-.095,.33),.007,'cream',5,end=.002)
                beam((side*.05,-.09,.28),(side*.07,-.07,.296),.006,'cream',5,end=.002)
    beam((0,.125,.16),(0,.17,.10),.011,'trunk',5,end=.005)
    if kind=='horses':
        cube((0,-.055,.209),(.018,.07,.032),'coal')
    if kind=='cattle':
        ico((.055,.02,.167),(.022,.042,.033),'trunk')

def pot(x=0,y=0,z=0,color='roof',scale=1):
    rings=[(z,.045*scale,x,y,0),(z+.025*scale,.062*scale,x,y,0),(z+.085*scale,.055*scale,x,y,0),(z+.105*scale,.032*scale,x,y,0),(z+.12*scale,.034*scale,x,y,0)]
    ring_mesh('Wheel-thrown vessel',rings,color,8)
    cone((x,y,z+.121*scale),.027*scale,.002,'ink',8,top=.027*scale)

def crystal(x,y,z,h,color):
    ring_mesh('Faceted mineral',[(z,.026,x,y,0),(z+h*.72,.033,x,y,0),(z+h,0,x+.012,y,0)],color,5)

def fish():
    ico((0,0,.105),(.13,.032,.055),'water')
    mesh('Forked fish tail',[(-.10,0,.11),(-.18,0,.16),(-.17,0,.11),(-.18,0,.065)],[(0,1,2),(0,2,3)],'teal')
    mesh('Dorsal fin',[(-.04,0,.145),(.015,0,.19),(.05,0,.143)],[(0,1,2)],'teal')
    ico((.078,-.025,.125),(.007,.005,.007),'ink')
    for x,y in [(-.08,.02),(.12,.03),(.02,-.08)]: ico((x,y,.018),(.019,.012,.018),'snow')

def derrick(small=False):
    h=.36 if small else .49
    for x in [-.08,.08]:
        for y in [-.07,.07]:
            beam((x,y,0),(x*.22,y*.22,h),.012,'coal',4)
    for z in [.08,.18,.28]:
        if z>h: continue
        r=.08*(1-z/h)+.018
        for y in [-r,r]:
            beam((-r,y,z),(r,y,z),.008,'iron',4)
            beam((-r,y,z),(r*.7,y*.7,min(z+.09,h)),.007,'iron',4)
    cube((0,0,h),(.09,.09,.022),'iron')
    beam((.13,.06,.02),(.13,.06,.13),.035,'coal',8)
    torus((.13,.06,.125),.035,.005,'gold')

def resource(kind):
    if kind=='wheat':
        for x,y,h in [(-.08,0,.12),(0,.025,.19),(.075,-.03,.14),(.01,-.08,.10)]: crystal(x,y,.015,h,'snow')
        rock((0,0,.012),(.17,.13,.012),'cream')
    elif kind=='rice':
        for x,y,s in [(-.08,0,.08),(.035,.025,.11),(.10,-.045,.07),(-.01,-.08,.06)]: rock((x,y,.018),(s,s*.72,.018),'teal' if s>.08 else 'leaf')
        for x,y in [(-.1,.02),(.02,.04),(.09,-.035)]: ico((x,y,.035),(.025,.018,.008),'leaf_light')
    elif kind=='cattle':
        for x,y,s in [(-.08,0,.10),(.045,.02,.11),(.10,-.06,.07)]:
            rock((x,y,.045),(s,s*.65,.045),'basalt'); rock((x,y,.085),(s*.70,s*.52,.022),'lichen'); rock((x+.025,y-.01,.10),(s*.32,s*.26,.016),'coral')
    elif kind=='sheep':
        torus((0,0,.025),.12,.018,'snow'); cone((0,0,.04),.075,.06,'basalt',8,top=.04)
        for x,y,z in [(-.025,0,.14),(.015,.01,.22),(.04,.015,.29)]: ico((x,y,z),(.025,.023,.037),'cream')
        for x,y in [(-.08,0),(.08,.015)]: ico((x,y,.025),(.028,.022,.016),'dryice')
    elif kind=='deer':
        cone((0,0,.07),.19,.14,'rock_dark',9,top=.14); cone((0,0,.11),.125,.035,'dryice',9,top=.105)
        ico((-.02,0,.13),(.08,.06,.018),'snow'); torus((0,0,.082),.17,.018,'rust')
    elif kind=='fish':
        for i in range(3): torus((0,0,.018+i*.007),.14-i*.035,.009,'ochre' if i%2 else 'rock')
        ico((0,0,.02),(.055,.045,.016),'basalt')
        for x,y in [(-.10,.035),(.09,-.025),(.02,.10)]: ico((x,y,.025),(.025,.018,.008),'sand')
    elif kind=='stone':
        for x,y,h in [(-.09,0,.16),(-.03,.025,.22),(.04,.02,.18),(.10,-.02,.13),(0,-.055,.14)]:
            cone((x,y,h/2),.045,h,'basalt',6,top=.038); cone((x,y,h+.004),.038,.009,'rock_dark',6,top=.035)
    elif kind=='bananas':
        for x,y,h in [(-.075,0,.13),(.02,.035,.19),(.09,-.035,.14)]:
            beam((x,y,0),(x,y,h),.014,'basalt',5); ico((x,y,h+.018),(.065,.055,.026),'leaf_dark'); ico((x,y,h+.012),(.048,.043,.018),'cryo')
    elif kind in ['gold','gems','iron','niter','coal']:
        rock((0,0,.035),(.17,.13,.045),'basalt')
        if kind=='gold':
            for x,y,s in [(-.08,0,.052),(.01,.025,.07),(.075,-.035,.045)]: rock((x,y,.065),(s,s*.78,s*.62),'platinum')
        elif kind=='gems':
            for x,y,h in [(-.08,0,.13),(0,.025,.20),(.075,-.035,.15)]: crystal(x,y,.035,h,'opal'); crystal(x+.012,y-.012,.04,h*.7,'cryo')
        elif kind=='iron':
            for x,y,h in [(-.07,0,.11),(.01,.025,.18),(.08,-.025,.12)]: rock((x,y,h*.48),(.06,.05,h*.48),'iron'); rock((x-.02,y-.025,h*.40),(.025,.02,.025),'basalt')
        elif kind=='niter':
            for x,y in [(-.08,0),(.03,.035),(.09,-.04)]: crystal(x,y,.025,.11,'jarosite'); rock((x,y,.02),(.07,.045,.018),'cream')
        else:
            rock((-.055,.01,.055),(.09,.075,.06),'coal'); ico((.04,0,.065),(.065,.055,.06),'ink')
            for x,y,z in [(-.03,-.04,.10),(.05,-.025,.11),(.02,.04,.12)]: ico((x,y,z),(.018,.018,.018),'lichen')
    elif kind=='silk':
        for x,y in [(-.075,0),(.07,.02)]:
            cone((x,y,.10),.052,.18,'steel',8,top=.052); torus((x,y,.15),.054,.006,'cream'); ico((x,y,.20),(.058,.058,.012),'glass')
        for i in range(4):
            a=i*math.tau/4; beam((-.075,0,.19),(.07+.11*math.cos(a),.02+.08*math.sin(a),.14),.004,'cream',4)
        torus((0,0,.07),.10,.005,'cryo')
    elif kind=='spices':
        for x,y in [(-.06,0),(.055,.025)]:
            cube((x,y,.045),(.105,.075,.085),'steel',.008); cube((x,y,.092),(.08,.052,.012),'glass',.003)
            cone((x,y,.105),.018,.012,'berry',6,top=.004); cube((x,y-.042,.045),(.018,.006,.05),'hazard')
    elif kind=='wine':
        cube((0,0,.085),(.25,.19,.17),'timber',.008)
        for x in [-.075,0,.075]: cone((x,-.025,.14),.021,.11,'red',7,top=.017); cone((x,-.025,.198),.012,.018,'gold',7,top=.012)
        for z in [.025,.145]: beam((-.12,-.10,z),(.12,-.10,z),.012,'steel',4)
        cube((0,-.105,.08),(.07,.009,.035),'cream')
    elif kind=='incense':
        for x,y in [(-.07,0),(.04,.025),(.01,-.065)]:
            cube((x,y,.04),(.10,.075,.075),'soil',.006); cube((x,y,.08),(.09,.068,.012),'timber',.003)
            beam((x,y-.04,.03),(x,y-.04,.05),.008,'cream',4)
    elif kind=='furs':
        for x,y,z in [(-.07,0,.07),(.04,.025,.09),(.08,-.055,.055)]:
            cube((x,y,z),(.12,.10,.11),'aerogel',.012)
            for dx in [-.035,.035]: beam((x+dx,y-.052,z-.035),(x+dx,y-.052,z+.035),.004,'glass',4)
    elif kind=='pearls':
        rock((0,0,.035),(.17,.12,.04),'rock_dark')
        for x,y,z in [(-.09,0,.07),(-.04,.035,.10),(.025,.015,.075),(.08,-.02,.11),(.11,.045,.065),(-.025,-.055,.065)]:
            ico((x,y,z),(.027,.025,.024),'coal'); ico((x-.008,y-.012,z+.018),(.008,.007,.006),'steel')
    elif kind=='marble':
        for x,y,s in [(-.08,0,.11),(.025,.02,.14),(.11,-.035,.08)]:
            rock((x,y,s*.55),(s,s*.72,s*.60),'lichen'); beam((x-s*.4,y-s*.2,s*.52),(x+s*.25,y-s*.3,s*.65),.004,'leaf_light',4)
    elif kind=='ivory':
        rock((0,0,.07),(.17,.13,.075),'basalt')
        for sign in [-1,1]: crystal(sign*.045,0,.07,.16,'platinum'); rock((sign*.045,0,.06),(.065,.06,.055),'iron')
    elif kind=='dyes':
        rock((0,0,.025),(.18,.13,.025),'rock_dark')
        for x,y in [(-.09,0),(.015,.03),(.09,-.04)]: cone((x,y,.07),.065,.06,'jarosite',7,top=.018); rock((x,y,.108),(.035,.03,.008),'ochre')
    elif kind=='cotton':
        cube((0,0,.018),(.34,.25,.035),'steel',.008)
        for x,y in [(-.10,-.06),(-.035,.045),(.05,-.045),(.11,.055)]:
            cone((x,y,.075),.016,.12,'lichen',5,top=.009)
            for side in [-1,1]: ico((x+side*.024,y,.13),(.03,.023,.025),'cream')
    elif kind=='sugar':
        torus((0,0,.035),.235,.012,'steel')
        for a in range(8):
            t=a*math.tau/8
            beam((.235*math.cos(t),.235*math.sin(t),.035),(.15*math.cos(t),.15*math.sin(t),.31),.008,'steel',5)
        torus((0,0,.31),.15,.009,'glass')
        for x,y,h in [(-.09,0,.17),(.02,.035,.21),(.09,-.04,.15)]:
            beam((x,y,.03),(x,y,h),.009,'trunk',5)
            for side in [-1,1]: blade((x,y,h*.55),(x+side*.045,y+.02,h*.72),.02,'leaf')
            ico((x,y,h),(.035,.027,.025),'leaf_light')
    elif kind=='whales':
        cube((0,.025,.055),(.17,.22,.09),'steel',.012); cube((-.23,.025,.075),(.25,.12,.012),'steel',.004); cube((.23,.025,.075),(.25,.12,.012),'steel',.004)
        beam((0,-.04,.10),(0,-.10,.22),.018,'iron',6); torus((0,-.105,.23),.07,.009,'steel')
        rock((-.12,.08,.04),(.10,.12,.05),'rust')
        for x in [-.30,-.18,.18,.30]: beam((x,-.035,.083),(x,.085,.083),.004,'cryo',4)
    elif kind=='horses':
        for x in [-.07,.07]:
            cone((x,0,.11),.05,.21,'steel',8,top=.05); torus((x,0,.17),.052,.007,'hazard'); cube((x,-.054,.12),(.035,.008,.05),'ink')
        beam((-.07,0,.23),(.07,0,.23),.015,'steel',5); crystal(0,.07,.01,.13,'dryice')
    elif kind=='oil':
        rock((0,0,.045),(.20,.16,.06),'dryice'); crystal(-.08,.01,.045,.11,'cryo'); crystal(.06,.025,.05,.14,'snow')
        cube((.12,-.04,.13),(.11,.10,.12),'steel',.008); beam((.12,-.04,.19),(.12,-.04,.30),.009,'hazard',5); torus((.12,-.04,.30),.025,.006,'hazard')
def fence(a,b):
    a,b=Vector(a),Vector(b)
    for p in [a,b]:
        cone((p.x,p.y,.09),.014,.18,'timber',5,top=.009)
    for z in [.065,.13]: beam(a+Vector((0,0,z)),b+Vector((0,0,z)),.01,'cream',4)

def tent(x=0,y=0,scale=1,color='sand'):
    verts=[(x+px*scale,y+py*scale,pz*scale) for px,py,pz in [(-.16,-.14,0),(.16,-.14,0),(0,-.14,.23),(-.16,.14,0),(.16,.14,0),(0,.14,.23)]]
    mesh('Canvas ridge tent',verts,[(0,3,5,2),(2,5,4,1),(3,4,5)],color)
    mesh('Dark tent interior',[(x-.12*scale,y+.02*scale,0),(x+.12*scale,y+.02*scale,0),(x,y+.02*scale,.19*scale)],[(0,1,2)],'ink')
    for dy in [-.16,.16]: beam((x,y+dy*scale,0),(x,y+dy*scale,.245*scale),.012*scale,'timber',5)
    beam((x,y-.18*scale,.235*scale),(x,y+.18*scale,.235*scale),.012*scale,'timber',5)

def building(x=0,y=0,color='roof'):
    cube((x,y,.10),(.28,.23,.20),'stone',.008)
    mesh('Pitched tile roof',[(x-.18,y-.15,.20),(x+.18,y-.15,.20),(x,y-.15,.31),(x-.18,y+.15,.20),(x+.18,y+.15,.20),(x,y+.15,.31)],[(0,1,2),(3,5,4),(0,2,5,3),(2,1,4,5)],color)
    cube((x,y-.119,.061),(.064,.012,.12),'trunk')
    cube((x+.09,y-.121,.115),(.043,.015,.055),'water')

def boat(x=0,y=0):
    obj=ring_mesh('Clinker fishing hull',[(.01,.045,x,y,0),(.055,.13,x,y,0),(.09,.145,x,y,0)],'timber',6)
    # Hull is a narrow, pointed launch rather than a round basket.
    for v in obj.data.vertices:
        v.co.x=x+(v.co.x-x)*.48
    beam((x,y,.05),(x,y,.33),.011,'trunk',6)
    mesh('Cream lateen sail',[(x,y,.32),(x+.145,y+.025,.13),(x+.012,y,.13)],[(0,1,2)],'cream')
    beam((x,y-.055,.10),(x+.10,y+.035,.05),.008,'gold',5)

def improvement(kind):
    if kind=='farm':  # Greenhouse Dome
        for x,y,r in [(-.22,0,.18),(.20,.04,.21)]:
            for a in range(4):
                t=a*math.pi/2
                beam((x+r*math.cos(t),y,.025),(x+r*.7*math.cos(t),y+r*.7*math.sin(t),.14),.009,'steel',5)
            torus((x,y,.025),r,.012,'cream')
            for a in range(4):
                t=a*math.pi/2
                beam((x+r*math.cos(t),y+r*math.sin(t),.025),(x+r*.7*math.cos(t),y+r*.7*math.sin(t),.14),.009,'steel',5)
            for dx in [-.07,0,.07]: cone((x+dx,y-.03,.045),.012,.055,'lichen',5,top=.006)
    elif kind=='mine':  # Regolith Mine
        rock((0,.07,.13),(.39,.31,.16),'rust')
        cone((0,.07,.18),.23,.10,'basalt',8,top=.16)
        cube((0,-.18,.12),(.22,.07,.21),'steel',.008)
        for x in [-.13,.13]: beam((x,-.18,.20),(x,-.18,.34),.018,'hazard',5)
        cube((0,-.18,.35),(.31,.08,.035),'steel')
        for x in [-.08,.08]: beam((x,-.39,.012),(x,-.15,.012),.008,'basalt',4)
        cube((.25,-.18,.075),(.13,.12,.12),'hazard',.008)
    elif kind=='pasture':  # Bioreactor
        for x,y,r,h in [(-.14,0,.075,.22),(.12,.03,.085,.26)]:
            cone((x,y,h/2),r,h,'steel',8,top=r)
            torus((x,y,h*.76),r*1.02,.009,'cryo')
            cube((x,y-.077,h*.46),(.045,.008,.05),'glass')
        beam((-.14,0,.24),(.12,.03,.28),.012,'steel',5)
        for x in [-.30,.29]: cube((x,0,.035),(.07,.10,.07),'basalt',.006)
    elif kind=='plantation':  # Hydroponics Bay
        cube((0,0,.055),(.55,.40,.11),'steel',.012)
        for z in [.12,.23]:
            for x in [-.20,0,.20]:
                cube((x,0,z),(.16,.32,.055),'glass',.008)
                for y in [-.10,0,.10]: cone((x,y,z+.045),.018,.035,'leaf',5,top=.008)
        for x in [-.27,.27]: beam((x,-.20,.02),(x,-.20,.29),.014,'steel',5)
        cube((0,0,.30),(.58,.06,.025),'cryo')
    elif kind=='lumbermill':  # Sinter Works
        cube((-.10,.03,.13),(.34,.29,.25),'basalt',.018)
        cone((-.10,.03,.29),.20,.09,'steel',8,top=.16)
        cone((-.10,.03,.345),.11,.025,'hazard',8,top=.09)
        beam((-.10,.03,.34),(-.10,.03,.46),.018,'steel',5)
        cube((.21,-.04,.06),(.22,.25,.12),'rust',.01)
        for x in [.14,.27]: cube((x,-.04,.16),(.025,.18,.10),'steel',.004)
        cube((.21,-.04,.22),(.18,.10,.018),'hazard')
    elif kind=='quarry':  # Basalt Quarry
        for z,w in [(.08,.64),(.17,.50),(.27,.34)]:
            cube((0,.03,z),(w,.42,z*1.45),'basalt',.01)
            for x in [-w*.30,w*.30]: cube((x,-.19,z),(.012,.008,z*1.1),'rock_dark')
        cube((.25,-.25,.055),(.14,.13,.11),'steel',.008)
        rock((-.24,-.27,.06),(.11,.08,.06),'rock')
    elif kind=='fishing_boats':  # Dust Skimmer
        for x,y in [(-.17,0),(.18,.07)]:
            cone((x,y,.07),.16,.12,'steel',6,top=.12)
            cube((x,y,.13),(.18,.09,.045),'hazard',.008)
            beam((x,y,.16),(x,y,.29),.012,'steel',5)
            mesh('Skimmer vane',[(x,y,.28),(x+.14,y,.14),(x+.01,y,.14)],[(0,1,2)],'cream')
            for side in [-1,1]: beam((x+side*.13,y,.025),(x+side*.13,y,.05),.012,'cryo',5)
    elif kind=='camp':  # Extraction Rig
        cube((0,0,.025),(.44,.34,.05),'basalt',.008)
        for x in [-.13,.13]: beam((x,.04,.04),(x,.04,.37),.017,'steel',5)
        beam((-.13,.04,.36),(.13,.04,.36),.018,'hazard',5)
        beam((0,.04,.36),(0,.04,.12),.012,'steel',5)
        cone((0,.04,.13),.075,.16,'steel',8,top=.04)
        for x in [-.21,.21]: cube((x,-.10,.09),(.08,.10,.12),'hazard',.008)
    elif kind=='trading_post':  # Relay Station
        cube((0,0,.09),(.29,.24,.18),'steel',.012)
        cone((0,0,.20),.16,.12,'glass',8,top=.10)
        beam((0,0,.25),(0,0,.48),.014,'steel',5)
        torus((0,0,.47),.075,.008,'cryo')
        for x in [-.20,.20]:
            cube((x,.04,.07),(.11,.14,.13),'solar',.005)
            for z in [.03,.08,.13]: beam((x-.045,.04,z),(x+.045,.04,z),.003,'steel',4)
    elif kind=='oil_well':  # Deep Drill
        cube((0,0,.025),(.42,.34,.05),'basalt',.008)
        for x in [-.12,.12]: beam((x,.02,.05),(x*.6,.02,.43),.018,'steel',5)
        beam((-.072,.02,.42),(.072,.02,.42),.02,'hazard',5)
        beam((0,.02,.41),(0,.02,.12),.016,'steel',5)
        cone((0,.02,.11),.07,.12,'steel',8,top=.045)
        torus((0,.02,.06),.11,.01,'cryo')
def misc(key):
    if key=='camp_barbarian':
        tent(0,.03,1.35,'red')
        for x in [-.28,-.21,.21,.28]: cone((x,.18,.11),.025,.22,'trunk',5)
        beam((.27,-.08,0),(.27,-.08,.35),.014,'timber',5)
        mesh('Raider pennant',[(.27,-.08,.34),(.40,-.08,.32),(.34,-.08,.28),(.27,-.08,.29)],[(0,1,2,3)],'red')
        for x,y in [(-.05,-.27),(.04,-.26),(0,-.34)]: rock((x,y,.014),(.027,.022,.025))
        cone((0,-.285,.046),.033,.09,'gold',6)
        cone((0,-.285,.066),.024,.095,'coral',5)
    elif key=='ruin_ancient':
        cube((0,0,.025),(.50,.35,.05),'rock',.012)
        for x,h in [(-.16,.27),(.16,.19)]:
            cube((x,.04,.065),(.12,.12,.08),'stone',.008)
            cone((x,.04,.10+h/2),.044,h,'stone',7,top=.040)
            cube((x,.04,.105+h),(.115,.105,.035),'stone',.006)
        beam((-.18,.04,.395),(.015,.04,.335),.055,'stone',4)
        rock((.23,-.11,.045),(.08,.07,.06),'stone')
        ico((-.19,-.08,.075),(.07,.065,.06),'leaf_dark')
    elif key=='road_marker':
        rock((-.035,.01,.045),(.12,.09,.05),'basalt')
        rock((.015,.01,.09),(.09,.07,.05),'rust')
        rock((-.055,.015,.13),(.065,.055,.045),'rock')
        beam((.01,.015,.11),(.01,.015,.33),.012,'steel',5)
        beam((.01,.015,.30),(.01,.015,.39),.008,'cryo',5)
        cone((.01,.015,.40),.025,.025,'hazard',6,top=.012)
        cube((.055,.015,.25),(.075,.018,.035),'hazard',.003)

KEYS=NATURE+['res_'+r for r in RESOURCES]+['imp_'+i for i in IMPROVEMENTS]+MISC

def budget(key):
    if key.startswith('tree_'): return 250
    if key.startswith('rock_'): return 150
    if key.startswith('mountain_'): return 1200
    return 1500

def main():
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    only=args[args.index('--only')+1:] if '--only' in args else KEYS
    if '--preview-only' not in args:
        entries=[]
        for key in only:
            clear()
            random.seed(key)
            if key in NATURE: nature(key)
            elif key.startswith('res_'): resource(key[4:])
            elif key.startswith('imp_'): improvement(key[4:])
            else: misc(key)
            entries.append(export(key,budget(key)))
        old=json.loads((MODELS/'manifest.nature.json').read_text()) if (MODELS/'manifest.nature.json').exists() else []
        by_key={e['key']:e for e in old+entries}
        ordered=[by_key[k] for k in KEYS if k in by_key]
        ordered.extend(e for e in old if e['key'] not in KEYS)
        write_manifest(ordered)
    if '--only' not in args:
        contact_sheet(NATURE[:10]+NATURE[14:],'foliage',5)
        contact_sheet(NATURE[10:14],'mountains',4,camera_height=8.5)
        contact_sheet(['res_'+r for r in RESOURCES],'resources',6)
        contact_sheet(['imp_'+i for i in IMPROVEMENTS]+MISC,'installations',5)
    print('AEONS NATURE COMPLETE',flush=True)

if __name__=='__main__': main()
