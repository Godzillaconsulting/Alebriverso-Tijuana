extends RigidBody3D

var broken = false

func break_crate():
	if broken: return
	broken = true
	
	# Spawneo aleatorio de items (20% Bebida, 30% Trozo, 50% Nada)
	var r = randi() % 100
	if r < 20:
		spawn_item("bebida")
	elif r < 50:
		spawn_item("trozo")
	
	# Spawnear 5 escombros físicos (simulando que la madera estalla)
	for i in range(5):
		var debris = RigidBody3D.new()
		var m_inst = MeshInstance3D.new()
		var bm = BoxMesh.new()
		bm.size = Vector3(0.4, 0.4, 0.4)
		var mat = StandardMaterial3D.new()
		mat.albedo_color = Color(0.35, 0.22, 0.12) # Color madera oscura RE4
		bm.material = mat
		m_inst.mesh = bm
		
		var col = CollisionShape3D.new()
		var col_box = BoxShape3D.new()
		col_box.size = Vector3(0.4, 0.4, 0.4)
		col.shape = col_box
		
		debris.add_child(m_inst)
		debris.add_child(col)
		
		# Añadir la basura física al mundo
		get_parent().add_child(debris)
		debris.global_position = global_position + Vector3(randf_range(-0.5, 0.5), randf_range(0.5, 1.5), randf_range(-0.5, 0.5))
		
		# Aplicar un impulso hiper-rápido hacia todas partes (¡EXPLOSIÓN!)
		debris.apply_central_impulse(Vector3(randf_range(-5, 5), randf_range(5, 10), randf_range(-5, 5)))
		
		# Autodestrucción después de 3 segundos
		get_tree().create_timer(3.0).timeout.connect(debris.queue_free)
		
	# Eliminar la caja original
	queue_free()

func spawn_item(tipo: String):
	var item = Area3D.new()
	var mesh = MeshInstance3D.new()
	if tipo == "bebida":
		var m = CylinderMesh.new()
		m.top_radius = 0.2; m.bottom_radius = 0.15; m.height = 0.5
		mesh.mesh = m
		var mat = StandardMaterial3D.new()
		mat.albedo_color = Color(0.4, 0.2, 0.0) # Chocolate
		mat.emission_enabled = true; mat.emission = Color(0.2, 0.1, 0.0)
		mesh.material_override = mat
	else:
		var m = BoxMesh.new()
		m.size = Vector3(0.3, 0.2, 0.3)
		mesh.mesh = m
		var mat = StandardMaterial3D.new()
		mat.albedo_color = Color(0.3, 0.15, 0.0)
		mesh.material_override = mat
	item.add_child(mesh)
	
	var col = CollisionShape3D.new()
	var shape = SphereShape3D.new()
	shape.radius = 0.5
	col.shape = shape
	item.add_child(col)
	
	item.set_script(load("res://scripts/item_drop.gd"))
	item.set_meta("tipo", tipo)
	
	get_parent().call_deferred("add_child", item)
	item.position = global_position

