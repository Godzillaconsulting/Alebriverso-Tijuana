extends Node

var hud
var cine_cam: Camera3D
var is_playing = false
var is_skipped = false
var current_tween: Tween
var player_ref: CharacterBody3D
var can_skip = false

func _ready():
	hud = load("res://scripts/cinematic_hud.gd").new()
	add_child(hud)
	set_process_input(true)

func _input(event):
	if is_playing and not is_skipped and can_skip:
		if event.is_action_pressed("ui_cancel") or event.is_action_pressed("shoot") or event.is_action_pressed("ui_accept"):
			skip_cutscene()

func play_intro_cutscene(player: CharacterBody3D):
	if is_playing: return
	is_playing = true
	is_skipped = false
	player_ref = player
	
	# 1. Bloquear al jugador
	player.set_physics_process(false)
	player.set_process_unhandled_input(false)
	
	var normal_hud = get_tree().get_root().find_child("HUD", true, false)
	if normal_hud: normal_hud.visible = false
	
	# 2. Crear cámara de cine
	cine_cam = Camera3D.new()
	add_child(cine_cam)
	cine_cam.make_current()
	
	cine_cam.global_position = Vector3(0, 40, -30)
	cine_cam.rotation_degrees = Vector3(-30, 0, 0)
	hud.show_bars(1.5)
	
	# Habilitar el salto después de 2 segundos para evitar que el click inicial lo cancele
	get_tree().create_timer(2.0).timeout.connect(func(): can_skip = true)
	
	# 3. Secuencia
	current_tween = create_tween()
	current_tween.tween_property(cine_cam, "global_position", Vector3(0, 5, -80), 6.0).set_trans(Tween.TRANS_SINE)
	
	await get_tree().create_timer(1.0).timeout
	if is_skipped: return
	hud.set_subtitle("Tijuana, 2026. Era mi deber guiar su alma a través del tráfico y la muerte...")
	
	await get_tree().create_timer(5.0).timeout
	if is_skipped: return
	
	cine_cam.global_position = Vector3(0, 2, -120)
	cine_cam.rotation_degrees = Vector3(0, 180, 0)
	hud.set_subtitle("Pero ese cártel de brujos... usando reliquias malditas, desgarraron el velo.")
	
	current_tween = create_tween()
	current_tween.tween_property(cine_cam, "global_position", Vector3(0, 2, -150), 5.0)
	
	await get_tree().create_timer(5.0).timeout
	if is_skipped: return
	
	cine_cam.global_position = player.global_position + Vector3(0, 5, 10)
	cine_cam.rotation_degrees = Vector3(-20, 0, 0)
	hud.set_subtitle("Me arrastraron al Mictlán. Robaron el alma que juré proteger.")
	
	current_tween = create_tween().set_parallel(true)
	current_tween.tween_property(cine_cam, "global_position", player.global_position + Vector3(1, 1.5, 3), 4.0)
	current_tween.tween_property(cine_cam, "rotation_degrees", Vector3(-5, 0, 0), 4.0)
	
	await get_tree().create_timer(4.0).timeout
	if is_skipped: return
	
	hud.set_subtitle("La cacería comienza aquí. Y cobraré cada lágrima con sangre de obsidiana.")
	await get_tree().create_timer(4.0).timeout
	if is_skipped: return
	
	end_cutscene()

func skip_cutscene():
	is_skipped = true
	if current_tween:
		current_tween.kill()
	end_cutscene()

func end_cutscene():
	hud.hide_bars(0.5)
	hud.set_subtitle("")
	
	if is_instance_valid(cine_cam):
		cine_cam.queue_free()
		
	var normal_hud = get_tree().get_root().find_child("HUD", true, false)
	if normal_hud: normal_hud.visible = true
	
	if is_instance_valid(player_ref):
		player_ref.set_physics_process(true)
		player_ref.set_process_unhandled_input(true)
		player_ref.set_process(true)
		if "camera" in player_ref and is_instance_valid(player_ref.camera):
			player_ref.camera.make_current()
	is_playing = false
