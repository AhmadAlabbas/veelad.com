"""Render Veelad-owned generic product mockups and camera-projected print meshes.
Run: blender --background --python tools/render-mockups.py -- --output /tmp/veelad-mockups
No AI, stock photographs, third-party product models, or runtime Blender dependency.
"""
import bpy, bmesh, math, json, os, sys, argparse
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--only',default='');a=p.parse_args(args)
os.makedirs(a.output,exist_ok=True)
SIZE=1000

def material(name,color,rough=.65,fabric=False,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;b=n.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Roughness'].default_value=rough;b.inputs['Metallic'].default_value=metal
 if fabric:
  tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=210;tex.inputs['Detail'].default_value=2
  bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12;bump.inputs['Distance'].default_value=.014;m.node_tree.links.new(tex.outputs['Fac'],bump.inputs['Height']);m.node_tree.links.new(bump.outputs['Normal'],b.inputs['Normal'])
 return m

def mesh(name,verts,faces,mat,smooth=False):
 d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.data.materials.append(mat)
 for f in o.data.polygons:f.use_smooth=smooth
 return o

def curve(name,points,radius,mat,cyclic=False):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=radius;c.bevel_resolution=3;s=c.splines.new('POLY');s.points.add(len(points)-1)
 for v,co in zip(s.points,points):v.co=(*co,1)
 s.use_cyclic_u=cyclic;o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.data.materials.append(mat);return o

def cube(name,loc,scale,mat,bevel=.05):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
 if bevel:m=o.modifiers.new('Soft manufactured edges','BEVEL');m.width=bevel;m.segments=5;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o

def inside(x,y,polygon):
 c=False;j=len(polygon)-1
 for i in range(len(polygon)):
  xi,yi=polygon[i];xj,yj=polygon[j]
  if (yi>y)!=(yj>y) and x<(xj-xi)*(y-yi)/(yj-yi)+xi:c=not c
  j=i
 return c

def cloth_z(x,y):return .045*math.sin(x*4+y*.5)*math.cos(y*2.4)+.018*math.sin(10*x+3*y)

def shirt(mat,thread,back=False):
 outline=[(-.42,1.5),(-1.09,1.36),(-1.66,.78),(-1.25,.36),(-.95,.61),(-.91,-1.55),(.91,-1.55),(.95,.61),(1.25,.36),(1.66,.78),(1.09,1.36),(.42,1.5)]
 for i in range(1,24):
  t=math.pi*i/24;outline.append((.42*math.cos(t),1.5-(.13 if back else .31)*math.sin(t)))
 # Triangulate the exact sewn outline before subdividing: no stair-step silhouette.
 o=mesh('Cotton T-shirt',[(x,y,0) for x,y in outline],[tuple(range(len(outline)))],mat,True)
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.subdivide_edges(bm,edges=list(bm.edges),cuts=16,use_grid_fill=True)
 for v in bm.verts:v.co.z=cloth_z(v.co.x,v.co.y)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
 s=o.modifiers.new('Fabric thickness','SOLIDIFY');s.thickness=.025
 b=o.modifiers.new('Soft sewn edges','BEVEL');b.width=.009;b.segments=3;b.limit_method='ANGLE';b.angle_limit=.7
 # Sewn collar and hems; no borrowed garment mesh.
 collar=[(.43*math.cos(math.pi*i/50),1.5-(.13 if back else .31)*math.sin(math.pi*i/50),cloth_z(.43*math.cos(math.pi*i/50),1.5-(.13 if back else .31)*math.sin(math.pi*i/50))+.015) for i in range(51)]
 curve('Ribbed neckline',collar,.04,thread)
 for y in [-1.50,-1.46]:curve('Double bottom stitching',[(x,y,cloth_z(x,y)+.012) for x in [i*.03-.86 for i in range(58)]],.0045,thread)
 for sign in [-1,1]:curve('Sleeve hem',[(sign*(1.25+t*.39),.38+t*.39,cloth_z(sign*(1.25+t*.39),.38+t*.39)+.01) for t in [i/30 for i in range(31)]],.012,thread)
 return surface(-.76,.76,-.93,.894,lambda x,y:(x,y,cloth_z(x,y)+.006),16,20)

def rounded(x,y,w,h,r):return abs(x)<=w/2 and abs(y)<=h/2 and (abs(x)<=w/2-r or abs(y)<=h/2-r or (abs(x)-(w/2-r))**2+(abs(y)-(h/2-r))**2<=r*r)

def surface(x0,x1,y0,y1,point,nx=12,ny=16,allowed=None):
 verts=[];uv=[];faces=[]
 for j in range(ny+1):
  y=y0+(y1-y0)*j/ny
  for i in range(nx+1):
   x=x0+(x1-x0)*i/nx;verts.append(point(x,y));uv.append((i/nx,1-j/ny))
 for j in range(ny):
  for i in range(nx):
   ids=[j*(nx+1)+i,j*(nx+1)+i+1,(j+1)*(nx+1)+i+1,(j+1)*(nx+1)+i]
   if allowed and not all(allowed(*verts[k]) for k in ids):continue
   faces.extend([(ids[0],ids[1],ids[2]),(ids[0],ids[2],ids[3])])
 return verts,uv,faces

def tote(mat,thread):
 cube('Canvas bag', (0,-.1,-.025),(2.28,2.5,.12),mat,.16)
 # Subtle front cloth body gives the texture a matching non-flat projection.
 data=surface(-1.08,1.08,-1.30,1.10,lambda x,y:(x,y,.065+.018*math.sin(x*5)*math.cos(y*3)),32,36)
 mesh('Woven front',data[0],data[2],mat,True)
 for z in [-.10,.10]:
  # Flat, sewn webbing handles, instead of round rope.
  v=[];f=[]
  for i in range(81):
   t=math.pi*i/80;x=.65*math.cos(t);y=1.02+1.1*math.sin(t)
   v.extend([(x-.065,y,z),(x+.065,y,z)])
   if i:f.append((2*i-2,2*i-1,2*i+1,2*i))
  h=mesh('Cotton webbing handle',v,f,mat,True);h.modifiers.new('Strap thickness','SOLIDIFY').thickness=.028
 for x in [-1.0,1.0]:curve('Bag seam',[(x,y,.092) for y in [i*.06-1.2 for i in range(37)]],.005,thread)
 return surface(-.87,.87,-1.03,.71,lambda x,y:(x,y,.074+.018*math.sin(x*5)*math.cos(y*3)),16,16)

def mug(mat,back=False):
 v=[];f=[];rings=[(.81,-1.29),(.88,-1.20),(.88,1.18),(.85,1.28),(.75,1.28),(.73,1.17),(.73,-1.13),(0,-1.13)]
 n=128
 for radius,y in rings:
  for i in range(n):t=2*math.pi*i/n;v.append((radius*math.sin(t),y,radius*math.cos(t)))
 for r in range(len(rings)-1):
  for i in range(n):j=(i+1)%n;f.append((r*n+i,r*n+j,(r+1)*n+j,(r+1)*n+i))
 mesh('Glazed ceramic mug',v,f,mat,True)
 curve('Ceramic handle',[(1.03+.53*math.cos(2*math.pi*i/100),.83*math.sin(2*math.pi*i/100),0) for i in range(100)],.13,mat,True)
 # Full wrap coordinates; only front-facing cylinder triangles are included.
 theta0=-math.pi;theta1=math.pi;vertices=[];uv=[];faces=[];nx=96;ny=14
 for j in range(ny+1):
  y=-1.075+2.15*j/ny
  for i in range(nx+1):t=theta0+(theta1-theta0)*i/nx;vertices.append((.885*math.sin(t),y,.885*math.cos(t)));uv.append((i/nx,1-j/ny))
 for j in range(ny):
  for i in range(nx):
   theta=theta0+(theta1-theta0)*(i+.5)/nx
   if math.cos(theta)*(-1 if back else 1)<.12:continue
   k=j*(nx+1)+i;faces.extend([(k,k+1,k+nx+2),(k,k+nx+2,k+nx+1)])
 return vertices,uv,faces

def notebook(mat,paper,ink):
 cube('Hardcover back',(0,0,-.12),(1.94,2.70,.06),mat,.06);cube('Paper block',(.035,0,-.025),(1.82,2.58,.15),paper,.025);cube('Hardcover front',(0,0,.09),(1.94,2.70,.07),mat,.06)
 cube('Cloth spine',(-.91,0,-.02),(.11,2.68,.27),mat,.04)
 for z in [i*.012-.085 for i in range(11)]:curve('Page edges',[(.94,-1.25,z),(.94,1.25,z)],.0018,ink)
 # Notebook dimensions are preview-only until a supplier supplies its template.
 return surface(-.91,.91,-1.28,1.28,lambda x,y:(x,y,.129),24,32,lambda x,y,z:rounded(x,y,1.82,2.56,.065))

def phone(mat,ink,metal):
 cube('Phone perimeter',(0,0,-.025),(1.45,2.85,.20),ink,.18);cube('Printable phone case',(0,0,.075),(1.40,2.80,.09),mat,.17)
 cube('Camera island',(-.31,.92,.15),(.66,.68,.11),ink,.11)
 for x,y in [(-.46,1.08),(-.17,1.08),(-.46,.78)]:
  bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=.115,depth=.035,location=(x,y,.229));o=bpy.context.object;o.data.materials.append(metal)
  bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=.084,depth=.008,location=(x,y,.251));bpy.context.object.data.materials.append(ink)
 cube('Side buttons',(.743,.38,-.01),(.03,.48,.065),metal,.012)
 def allowed(x,y,z):return rounded(x,y,1.32,2.72,.16) and not (-.66<x<.06 and .54<y<1.32)
 return surface(-.66,.66,-1.36,1.36,lambda x,y:(x,y,.125),44,80,allowed)

def print_sheet(mat):
 def point(x,y):return (x,y,.025+.024*(x*x+y*y)+.09*max(0,(-x-.75))*max(0,(-y-.85)))
 data=surface(-1.125,1.125,-1.5,1.5,point,32,40);o=mesh('Fine art paper',data[0],data[2],mat,True);o.modifiers.new('Paper thickness','SOLIDIFY').thickness=.012
 return data

def sticker(mat):
 cube('Rounded vinyl sticker',(0,0,.05),(2.18,2.18,.022),mat,.16)
 return surface(-1.06,1.06,-1.06,1.06,lambda x,y:(x,y,.068),40,40,lambda x,y,z:rounded(x,y,2.12,2.12,.14))

def render(key):
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 scene=bpy.context.scene;scene.render.engine=os.environ.get('VEELAD_RENDER_ENGINE','CYCLES');scene.cycles.device='CPU';scene.cycles.samples=96;scene.cycles.use_denoising=False;scene.render.resolution_x=SIZE;scene.render.resolution_y=SIZE;scene.render.resolution_percentage=100
 scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.world.color=(.65,.65,.65);scene.view_settings.view_transform='AgX';scene.render.film_transparent=False
 cotton=material('Unbranded ivory cotton',(.83,.81,.76),.82,True);thread=material('Sewn cotton seams',(.70,.69,.65),.8);ceramic=material('White ceramic',(.91,.90,.87),.22);white=material('Warm white cover',(.87,.85,.80),.48);paper=material('Natural paper',(.89,.87,.81),.9,True);ink=material('Graphite rubber',(.024,.028,.033),.46);metal=material('Brushed camera surround',(.16,.18,.21),.3,False,.65)
 if key.startswith('shirt'):data=shirt(cotton,thread,key.endswith('back'));scale=4.4;target=(0,0,0);cam=(.05,.08,9)
 elif key=='tote':data=tote(cotton,thread);scale=4.6;target=(0,.22,0);cam=(.25,.42,9)
 elif key.startswith('mug'):data=mug(ceramic,key.endswith('back'));scale=3.9;target=(.20,0,0);cam=(0,2.4,9)
 elif key=='notebook':data=notebook(white,paper,thread);scale=3.75;target=(0,0,0);cam=(2.5,1.7,8)
 elif key=='phone':data=phone(white,ink,metal);scale=3.75;target=(0,0,0);cam=(1.8,1.3,9)
 elif key=='print':data=print_sheet(paper);scale=4.15;target=(0,0,0);cam=(.7,1.2,9)
 else:data=sticker(white);scale=3.5;target=(0,0,0);cam=(.6,.8,9)
 if key=='mug-back':
  for obj in list(bpy.context.scene.objects):obj.rotation_euler.rotate_axis('Y',math.pi)
  data=([(-x,y,-z) for x,y,z in data[0]],data[1],data[2])
 # Neutral seamless studio surface and large softboxes, all authored here.
 floor=material('Studio backdrop',(.77,.75,.70),1)
 cube('Backdrop',(0,0,-1.05),(200,200,.1),floor,0)
 def light(loc,power,size):
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
 light((-3,4,7),750,5);light((4,-1,5),320,4);light((0,-5,3),120,3)
 bpy.ops.object.camera_add(location=cam);camera=bpy.context.object;direction=(Vector(target)-camera.location).normalized();right=direction.cross(Vector((0,1,0))).normalized();up=right.cross(direction);camera.rotation_euler=Matrix((right,up,-direction)).transposed().to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=scale;scene.camera=camera;bpy.context.view_layer.update()
 verts,uv,faces=data;projected=[]
 for co,tex in zip(verts,uv):
  p=world_to_camera_view(scene,camera,Vector(co));projected.append([round(p.x*SIZE,3),round((1-p.y)*SIZE,3),round(tex[0],5),round(tex[1],5)])
 bpy.context.scene.render.filepath=os.path.join(a.output,key+'.png');bpy.ops.render.render(write_still=True)
 with open(os.path.join(a.output,key+'.json'),'w') as f:json.dump({'width':SIZE,'height':SIZE,'vertices':projected,'triangles':faces},f,separators=(',',':'))
 print('VEELAD_RENDER_COMPLETE',key,flush=True)

for key in ['shirt','shirt-back','tote','mug','mug-back','notebook','phone','print','sticker']:
 if not a.only or key in a.only.split(','):render(key)
