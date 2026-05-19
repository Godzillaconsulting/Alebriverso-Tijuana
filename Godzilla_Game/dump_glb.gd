extends SceneTree

func _init():
	var gltf = GLTFDocument.new()
	var state = GLTFState.new()
	var path = ProjectSettings.globalize_path("res://models/tijuana_rigged.glb")
	if FileAccess.file_exists(path):
		var err = gltf.append_from_file(path, state)
		if err == OK:
			var node = gltf.generate_scene(state)
			print_tree_recursive(node, "")
		else:
			print("Error load glb")
	else:
		print("File not found")
	quit()

func print_tree_recursive(node: Node, indent: String):
	print(indent + node.name + " (" + node.get_class() + ")")
	if node is Skeleton3D:
		for i in range(node.get_bone_count()):
			print(indent + "  Bone: " + node.get_bone_name(i))
	for child in node.get_children():
		print_tree_recursive(child, indent + "  ")
