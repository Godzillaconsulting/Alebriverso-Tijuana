extends StaticBody3D

var broken = false

func break_crate():
	if broken: return
	broken = true
	
	# Darle los puntos al jugador
	var players = get_tree().get_nodes_in_group("player")
	if players.size() > 0:
		players[0].sumar_cacao(1)
	
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
