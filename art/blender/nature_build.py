"""Generate AEONS foliage, geology, all 27 resources and 10 improvements.

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
MISC = ['camp_barbarian','ruin_ancient','road_marker']

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

def alpine_pine(x,y,z,h=.17):
    cone((x,y,z+h*.22),h*.048,h*.44,'trunk',5,top=h*.032)
    for dz,r,depth,color in [(.42,.26,.48,'leaf_dark'),(.65,.20,.43,'leaf'),(.83,.13,.34,'leaf_light')]:
        cone((x,y,z+h*dz),h*r,h*depth,color,5)

def crag(x,y,r,h,lean=(0,0),snowline=None,phase=0):
    """A chisel-cut massif: projecting ribs, recessed gullies, strata and a true apex."""
    n=10
    ribs=[1,.88,1.04,.81,.93,1.07,.84,.97,.78,.92]
    levels=[(0,1),(.15,.91),(.31,.69),(.34,.67),(.52,.43),(.55,.41)]
    if snowline is not None:
        levels.append((snowline,1-snowline))
    else:
        levels.append((.78,.19))
    verts=[]
    for row,(fraction,width) in enumerate(levels):
        for i in range(n):
            a=i*math.tau/n+phase
            # Broken strata follow the ribs rather than forming uniform cone bands.
            z=fraction*h
            if row>0:
                z+=h*(.018*math.sin(i*2.1+row*.7))
            radial=width
            if row==len(levels)-1 and snowline is not None:
                dip=[-.075,.025,-.025,.07,-.09,.03,-.045,.055,-.08,.015][i]
                z=(fraction+dip)*h
                radial=(1-fraction-dip)*.96
            verts.append((x+r*radial*ribs[i]*math.cos(a)+lean[0]*fraction,
                          y+r*radial*ribs[i]*math.sin(a)+lean[1]*fraction,z))
    verts.append((x+lean[0],y+lean[1],h))
    faces=[tuple(range(n-1,-1,-1))]
    materials=[0]
    for row in range(len(levels)-1):
        for i in range(n):
            a=row*n+i; b=row*n+(i+1)%n
            faces.append((a,b,b+n,a+n))
            # Thin exposed sandstone seams split three substantial rock strata.
            materials.append(3 if row in [2,4] else (0 if row==0 else (1 if row<4 else 2)))
    apex=len(verts)-1
    for i in range(n):
        faces.append(((len(levels)-1)*n+i,(len(levels)-1)*n+(i+1)%n,apex))
        materials.append(4 if snowline is not None else 2)
    obj=mesh('Ribbed alpine summit',verts,faces,'625f55')
    for color in ['8a8177','b0a58e','c9bfae','snow']:
        obj.data.materials.append(mat(color))
    for polygon,material in zip(obj.data.polygons,materials):
        polygon.material_index=material
    return obj

def mountain(variant):
    # Each outline has a different summit axis and shoulder rhythm.
    forms={
        'a':[(.02,.12,.51,.99,(-.10,.015),None),(-.46,.04,.34,.59,(-.025,.025),None),(.37,.21,.31,.43,(.04,0),None)],
        'b':[(-.24,.13,.49,.91,(.10,.025),None),(.34,.06,.39,.65,(.07,.02),None),(-.28,-.34,.25,.35,(-.035,0),None)],
        'c':[(.12,.14,.45,1.0,(.025,-.025),.87),(-.31,.05,.36,.69,(-.09,.04),None),(.39,-.16,.30,.45,(.025,0),None)],
        'snow':[(0,.10,.52,1.0,(-.025,.025),.64),(-.39,.16,.35,.67,(-.035,.035),.71),(.40,.02,.33,.55,(.04,.03),.76)],
    }[variant]
    skirt='leaf' if variant in ['a','b'] else ('rock_dark' if variant=='c' else 'rock')
    knoll(0,0,.89,.87,.105,skirt)
    for j,(x,y,r,h,lean,snowline) in enumerate(forms):
        crag(x,y,r,h,lean,snowline,j*.36+.12)
    # Low, angular buttresses anchor the spires into the full hex footprint.
    for x,y,r,h in [(-.49,-.32,.22,.22),(.35,-.40,.27,.25),(.03,-.59,.23,.16)]:
        crag(x,y,r,h,(.015,.015),None,.2)
    if variant in ['a','b']:
        for x,y,z,h in [(-.65,-.22,.055,.22),(-.53,-.43,.065,.28),(-.68,-.39,.035,.18),(.51,-.34,.055,.24),(.64,-.23,.04,.20)]:
            alpine_pine(x,y,z,h)
    elif variant=='snow':
        for x,y in [(-.62,-.27),(.48,-.43)]:
            knoll(x,y,.15,.11,.035,'snow')

def reeds():
    for i in range(7):
        a=i*2.4; x=.075*math.cos(a); y=.065*math.sin(a); h=.14+(i%3)*.025
        beam((x,y,0),(x+.015,y,h),.006,'leaf',5)
        cone((x+.015,y,h),.013,.047,'trunk',5,top=.01)
        blade((x,y,.015),(x-.045,y+.015,.10),.012,'leaf_light',0)

def cactus():
    cone((0,0,.135),.039,.27,'leaf',7,top=.032)
    ico((0,0,.27),(.032,.032,.025),'leaf_light')
    for x,z in [(-.07,.10),(.075,.17)]:
        beam((0,0,z),(x,0,z),.022,'leaf',6)
        beam((x,0,z),(x,0,z+.08),.023,'leaf',6,end=.019)
        ico((x,0,z+.08),(.019,.019,.016),'leaf_light')
    ico((-.002,0,.298),(.027,.021,.019),'coral')

def flowers():
    for i in range(5):
        a=i*2.4; x=.09*math.cos(a); y=.08*math.sin(a); h=.065+(i%2)*.025
        beam((x,y,0),(x,y,h),.004,'leaf',4)
        for j in range(4):
            t=j*math.pi/2
            ico((x+.012*math.cos(t),y+.012*math.sin(t),h),(.016,.016,.007),'cream' if i%2 else 'coral')
        ico((x,y,h+.006),(.009,.009,.006),'gold')

def nature(key):
    if key=='tree_pine': pine()
    elif key=='tree_snowpine': pine(True)
    elif key=='tree_broadleaf': broadleaf()
    elif key=='tree_jungle': broadleaf(True)
    elif key=='tree_palm': palm()
    elif key=='bush':
        for pos,sz,c in [((-.045,0,.052),(.065,.066,.065),'leaf'),((.04,0,.07),(.075,.065,.085),'leaf_light'),((0,.045,.06),(.07,.06,.07),'leaf_dark')]:
            rock(pos,sz,c)
    elif key=='reeds': reeds()
    elif key=='cactus': cactus()
    elif key=='flowers': flowers()
    elif key=='rock_small': rock()
    elif key=='rock_large':
        rock((-.03,0,.13),(.21,.18,.16));rock((.14,-.08,.05),(.10,.09,.065),'rock_dark')
    elif key.startswith('mountain_'): mountain(key.split('_')[1])
    elif key=='hill_rocks':
        knoll(-.13,.035,.48,.40,.20,'leaf')
        knoll(.23,.13,.33,.30,.29,'leaf_light')
        for x,y,r,h,z in [(-.12,.10,.18,.26,.08),(.27,.17,.16,.26,.16),(.36,-.04,.14,.19,.08)]:
            crag(x,y,r,h,(.015,.025),None,.3).location.z=z
        alpine_pine(-.39,-.07,.07,.16)
        alpine_pine(-.29,-.18,.07,.12)
    elif key=='ice_floe':
        cone((0,0,.032),.31,.064,'water',7,top=.30)
        cone((-.015,0,.07),.29,.035,'snow',7,top=.26)
        cone((.28,.16,.025),.10,.05,'snow',5,top=.09)
    elif key=='reef_coral':
        rock((0,0,.025),(.18,.12,.035),'sand')
        for x,y,h in [(-.10,0,.13),(0,.03,.18),(.10,0,.11)]:
            beam((x,y,.02),(x,y,h),.022,'coral',5,end=.016)
            for side in [-1,1]:
                beam((x,y,h*.6),(x+side*.035,y,h*.85),.013,'pink',5)
                beam((x+side*.035,y,h*.85),(x+side*.035,y,h*1.1),.012,'pink',5)

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
    if kind in ['wheat','rice']:
        for x,y,h in [(-.04,0,.15),(0,.03,.19),(.04,0,.17)]: crop(x,y,h,kind)
        if kind=='wheat': torus((0,0,.075),.039,.007,'trunk')
        else: cone((0,0,.005),.10,.01,'water',8,top=.10)
    elif kind in ['cattle','sheep','deer','horses']: animal(kind)
    elif kind=='fish': fish()
    elif kind=='bananas': palm(True)
    elif kind in ['stone','marble']:
        cube((-.025,.01,.055),(.17,.12,.11),'stone',.008)
        cube((.015,.015,.13),(.13,.10,.04),'snow' if kind=='marble' else 'rock',.005)
        if kind=='marble':
            beam((-.044,-.047,.036),(.01,-.047,.082),.004,'rock',4)
            beam((.01,-.047,.082),(.037,-.047,.087),.004,'rock',4)
    elif kind in ['gold','gems','iron','niter','coal']:
        rock((0,0,.03),(.14,.105,.04),'rock_dark')
        color={'gold':'gold','gems':'teal','iron':'iron','niter':'snow','coal':'coal'}[kind]
        for x,y,h in [(-.07,0,.11),(.01,.02,.18),(.07,-.015,.125)]:
            if kind in ['gems','niter']: crystal(x,y,.035,h,color)
            else: rock((x,y,h*.5),(.045,.045,h*.45),color)
    elif kind=='silk':
        beam((0,0,0),(0,0,.15),.013,'trunk',5)
        for i in range(3):
            a=i*math.tau/3
            blade((0,0,.14),(.12*math.cos(a),.12*math.sin(a),.17),.05,'leaf')
        for x,y in [(-.05,-.03),(.04,-.02)]: ico((x,y,.162),(.031,.016,.018),'cream')
    elif kind=='spices':
        for x,y,c in [(-.05,0,'gold'),(.055,.02,'red')]:
            ring_mesh('Open spice sack',[(0,.05,x,y,0),(.055,.065,x,y,0),(.10,.045,x,y,0)],'sand',7)
            cone((x,y,.10),.046,.018,c,7,top=.025)
            torus((x,y,.10),.047,.005,'cream')
    elif kind=='wine':
        pot(.065,.035,0,'roof',1.25)
        for z,r in [(.04,.04),(.07,.055),(.10,.05)]:
            for i in range(4):
                a=i*math.pi/2
                ico((-.045+r*.5*math.cos(a),-.035+r*.5*math.sin(a),z),(.021,.021,.021),'berry')
        blade((-.04,-.03,.12),(-.09,-.04,.16),.03,'leaf')
    elif kind=='incense':
        cone((0,0,.045),.073,.06,'gold',8,top=.058)
        cone((0,0,.078),.055,.006,'coal',8,top=.055)
        for x,y in [(-.02,0),(.02,.012),(0,-.02)]:
            beam((x,y,.078),(x+.025,y,.19),.005,'trunk',5)
            ico((x+.025,y,.19),(.007,.007,.009),'coral')
        for x in [-.05,.05]: beam((x,0,0),(x,0,.03),.01,'gold',5)
    elif kind=='furs':
        for x in [-.085,.085]: beam((x,0,0),(x,0,.20),.011,'timber',5)
        beam((-.10,0,.19),(.10,0,.19),.012,'timber',5)
        mesh('Hanging fur hide',[(-.07,-.012,.18),(.07,-.012,.18),(.055,-.018,.07),(.025,-.018,.045),(0,-.018,.07),(-.045,-.018,.05)],[(0,1,2,3,4,5)],'cream')
        ico((0,-.024,.135),(.035,.008,.044),'trunk')
    elif kind=='pearls':
        ico((0,0,.025),(.115,.085,.03),'pink')
        shell=ico((0,.054,.078),(.11,.026,.08),'cream')
        shell.rotation_euler[0]=-.35
        for x in [-.035,0,.035]: ico((x,-.018,.06),(.021,.022,.022),'snow')
    elif kind=='ivory':
        for sign in [-1,1]:
            ring_mesh('Curved ivory tusk',[(0,.028,sign*.05,0,0),(.07,.026,sign*.065,0,0),(.13,.019,sign*.053,0,0),(.18,.012,sign*.025,0,0),(.20,0,sign*.002,0,0)],'cream',6)
    elif kind=='dyes':
        for x,y,c in [(-.065,0,'berry'),(.06,.025,'teal'),(.02,-.065,'red')]:
            pot(x,y,0,c,.75)
            cone((x,y,.093),.02,.003,c,8,top=.02)
    elif kind=='cotton':
        for x,y,h in [(-.05,0,.15),(.04,.015,.19),(0,-.04,.13)]:
            beam((x,y,0),(x,y,h),.007,'trunk',5)
            blade((x,y,.07),(x+.05,y,.12),.025,'leaf')
            for i in range(3):
                a=i*math.tau/3
                ico((x+.018*math.cos(a),y+.018*math.sin(a),h),(.028,.028,.028),'snow')
    elif kind=='sugar':
        for x,y,h in [(-.04,0,.23),(.02,.03,.28),(.04,-.025,.20)]:
            beam((x,y,0),(x,y,h),.012,'leaf_light',6)
            for z in [.06,.12,.18]: cone((x,y,z),.014,.008,'leaf',6,top=.014)
            blade((x,y,h-.04),(x+.06,y,h+.03),.025,'leaf')
    elif kind=='whales':
        ico((0,.02,.035),(.12,.075,.04),'water')
        mesh('Whale sounding tail',[(-.015,0,.045),(-.025,0,.11),(-.15,0,.16),(-.13,0,.205),(0,0,.17),(.13,0,.205),(.15,0,.16),(.025,0,.11),(.015,0,.045), (0,.025,.15)],[(0,1,9),(1,2,3,4,9),(4,5,6,7,9),(7,8,0,9)],'coal')
    elif kind=='oil': derrick(True)

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
    if kind=='farm':
        for x in [-.29,0,.29]:
            cube((x,0,.016),(.23,.64,.032),'earth',.006)
            for y in [-.25,-.12,.01,.14,.27]:
                for dx in [-.065,.065]:
                    # Low-count broad crop tufts remain readable at map distance.
                    cone((x+dx,y,.087),.023,.12,'gold',5,top=.012)
                    blade((x+dx,y,.04),(x+dx+.035,y,.10),.014,'leaf',0)
        fence((-.43,.38,0),(.43,.38,0))
    elif kind=='mine':
        rock((0,.07,.16),(.32,.23,.21),'rock_dark')
        cube((0,-.15,.105),(.20,.024,.20),'ink')
        for x in [-.12,.12]: cube((x,-.18,.11),(.043,.06,.22),'timber',.004)
        cube((0,-.18,.22),(.31,.065,.045),'timber',.004)
        for x in [-.067,.067]: beam((x,-.4,.009),(x,-.12,.009),.009,'coal',4)
        for y in [-.37,-.27]: cube((0,y,.008),(.19,.025,.016),'timber')
        cube((.22,-.22,.08),(.13,.105,.10),'iron',.008)
        rock((.22,-.22,.145),(.065,.048,.045),'coal')
    elif kind=='pasture':
        points=[(-.35,-.28,0),(.35,-.28,0),(.40,.22,0),(0,.38,0),(-.40,.22,0)]
        for i in range(5): fence(points[i],points[(i+1)%5])
        animal('cattle')
        cube((.21,.11,.05),(.12,.20,.10),'timber',.01)
        cube((.21,.11,.105),(.085,.17,.008),'gold')
    elif kind=='plantation':
        for y in [-.19,.19]:
            for x in [-.28,0,.28]:
                cone((x,y,.07),.017,.14,'trunk',5,top=.01)
                ico((x,y,.18),(.10,.10,.11),'leaf')
                for dx,dy in [(-.045,-.04),(.04,-.06)]: ico((x+dx,y+dy,.17),(.019,.019,.019),'coral')
        cube((0,0,.009),(.73,.045,.018),'sand')
    elif kind=='lumbermill':
        building(-.13,.08)
        cube((.20,-.04,.10),(.18,.25,.04),'timber')
        saw=cone((.2,-.02,.16),.07,.012,'steel',10,top=.07)
        saw.rotation_euler[0]=math.pi/2
        for x,z in [(.15,.034),(.24,.034),(.195,.10)]:
            beam((x,.15,z),(x,.38,z),.033,'trunk',7)
            beam((x,.145,z),(x,.15,z),.028,'sand',7)
    elif kind=='quarry':
        for y,z,w in [(.16,.15,.56),(0,.095,.46),(-.16,.035,.36)]:
            cube((0,y,z),(w,.17,z*2),'rock',.009)
            for x in [-w*.25,w*.25]: cube((x,y-.09,z),(.008,.006,z*1.6),'rock_dark')
        cube((.27,-.2,.055),(.14,.12,.11),'stone',.007)
        cube((-.22,-.29,.035),(.16,.10,.07),'stone',.006)
    elif kind=='fishing_boats':
        boat(-.13,0)
        boat(.19,.12)
        for x,y in [(-.25,-.12),(.22,-.08)]:
            beam((x,y,.005),(x+.12,y,.005),.006,'water',5)
    elif kind=='camp':
        tent(-.06,.04)
        for x,y in [(.20,-.12),(.22,-.05),(.15,-.08)]: rock((x,y,.012),(.026,.024,.018))
        cone((.19,-.08,.035),.025,.06,'gold',5)
        cone((.19,-.08,.052),.017,.065,'coral',5)
        for x in [.18,.29]: beam((x,.13,0),(x,.13,.15),.009,'timber',5)
        beam((.18,.13,.14),(.29,.13,.14),.009,'timber',5)
    elif kind=='trading_post':
        building(0,.08,'teal')
        for x in [-.16,.16]: beam((x,-.24,0),(x,-.24,.21),.012,'timber',5)
        cube((0,-.19,.22),(.37,.23,.025),'cream',.007)
        for x in [-.12,0,.12]: cube((x,-.19,.235),(.055,.23,.006),'roof')
        cube((0,-.23,.07),(.31,.12,.14),'timber',.006)
        pot(.10,-.23,.145,'gold',.42)
        pot(-.08,-.23,.145,'teal',.42)
    elif kind=='oil_well':
        cube((0,0,.012),(.35,.32,.024),'rock',.006)
        derrick()
        beam((-.20,.06,.07),(-.20,.23,.07),.065,'iron',8)
        beam((-.2,.06,.07),(-.12,.06,.07),.014,'coal',6)

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
        cube((0,0,.075),(.065,.052,.15),'stone',.008)
        cube((0,-.03,.092),(.033,.007,.012),'gold')
        rock((.055,.018,.02),(.035,.04,.024),'rock')

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
        if '--only' in args and (MODELS/'manifest.nature.json').exists():
            old=json.loads((MODELS/'manifest.nature.json').read_text())
            by_key={e['key']:e for e in old+entries}
            entries=[by_key[k] for k in KEYS if k in by_key]
        write_manifest(entries)
    if '--only' not in args:
        contact_sheet(NATURE[:10]+NATURE[14:],'foliage',5)
        contact_sheet(NATURE[10:14],'mountains',4,camera_height=8.5)
        contact_sheet(['res_'+r for r in RESOURCES],'resources',6)
        contact_sheet(['imp_'+i for i in IMPROVEMENTS]+MISC,'settlements',5)
    print('AEONS NATURE COMPLETE',flush=True)

if __name__=='__main__': main()
