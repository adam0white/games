extends Node2D

# The host owns all game facts. This renderer only decorates its projection.
var bridge: JavaScriptObject
var frame: Dictionary = {}
var elapsed: float = 0.0
var cell: float = 24.0
var origin: Vector2 = Vector2.ZERO
var map_width: int = 15
var map_height: int = 18
var font: Font
var label_boxes: Array[Rect2] = []
const INK: Color = Color("111f35")
const SNOW: Color = Color("a8c1cf")
const GOLD: Color = Color("d7a345")
const COATS: Array[Color] = [Color("83b6b0"), Color("c59ab7"), Color("9fafd1"), Color("b9b58b")]
# Only Yusuf wears this ring and label; no neighbour uses white or teal.
const YOU: Color = Color("ffffff")
const TARGET: Color = Color("5fe0c4")

func _ready() -> void:
    font = ThemeDB.fallback_font
    if OS.has_feature("web"):
        bridge = JavaScriptBridge.get_interface("HFBridge")
        if bridge != null:
            bridge.ready()

func _process(delta: float) -> void:
    elapsed += delta
    if bridge != null:
        var decoded: Variant = JSON.parse_string(str(bridge.get_frame()))
        if decoded is Dictionary:
            frame = decoded
    queue_redraw()

func _input(event: InputEvent) -> void:
    if bridge == null:
        return
    var position: Vector2 = Vector2.ZERO
    var tapped: bool = false
    if event is InputEventScreenTouch:
        if event.pressed:
            position = event.position
            tapped = true
    elif event is InputEventMouseButton:
        if event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
            position = event.position
            tapped = true
    if tapped:
        var target: Vector2 = (position - origin) / cell
        if target.x < 0 or target.y < 0 or target.x >= map_width or target.y >= map_height:
            return
        var player: Dictionary = frame.get("player", {})
        var dx: int = int(floor(target.x)) - int(player.get("x", 0))
        var dy: int = int(floor(target.y)) - int(player.get("y", 0))
        if abs(dx) > abs(dy):
            bridge.input(signi(dx), 0)
        elif dy != 0:
            bridge.input(0, signi(dy))

func at(x: float, y: float) -> Vector2:
    return origin + Vector2(x, y) * cell

func label(text: String, point: Vector2, color: Color, size: int = 11) -> void:
    var width: float = font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
    draw_string(font, point + Vector2(-width / 2.0, 0), text, HORIZONTAL_ALIGNMENT_LEFT, -1, size, color)

func _draw() -> void:
    label_boxes.clear()
    var viewport: Vector2 = get_viewport_rect().size
    draw_rect(Rect2(Vector2.ZERO, viewport), Color("091222"))
    if frame.is_empty():
        return
    map_width = int(frame.get("width", 15))
    map_height = int(frame.get("height", 18))
    cell = minf((viewport.x - 16.0) / map_width, (viewport.y - 14.0) / map_height)
    origin = (viewport - Vector2(map_width, map_height) * cell) / 2.0
    var tiles: Array = frame.get("tiles", [])
    var receipt: Array = []
    var wall_lookup: Dictionary = {}
    for value: Variant in tiles:
        var tile: Dictionary = value
        var x: int = int(tile.get("x", 0))
        var y: int = int(tile.get("y", 0))
        var lit: bool = bool(tile.get("lit", false))
        var wall: bool = bool(tile.get("wall", false))
        var point: Vector2 = at(x, y)
        var base: Color = Color("24394d") if (x + y) % 3 == 0 else Color("203448")
        if lit:
            base = Color("b88a40") if (x + y) % 3 == 0 else Color("a97a35")
        draw_rect(Rect2(point, Vector2.ONE * cell), base)
        # A fine cut at each tile boundary makes the host light grid legible.
        draw_rect(Rect2(point + Vector2.ONE * 0.35, Vector2.ONE * (cell - 0.7)), Color("f4dca0") if lit else Color("708c9f"), false, 0.45)
        if not wall:
            var fleck: Vector2 = Vector2(fposmod(x * 7.3 + y * 3.9, 0.65) + 0.15, 0.72)
            draw_line(point + fleck * cell, point + (fleck + Vector2(0.13, 0)) * cell, Color("e5d8b0") if lit else Color("7796ab"), 1.0)
        elif x > 0 and y > 0 and x < map_width - 1 and y < map_height - 1:
            wall_lookup[Vector2i(x, y)] = true
        else:
            draw_circle(point + Vector2.ONE * cell * 0.5, cell * 0.24, Color("587487"))
        # Host marks the exact contribution of Yusuf's lantern.
        if bool(tile.get("playerLit", false)):
            draw_rect(Rect2(point + Vector2.ONE * 2.0, Vector2.ONE * (cell - 4.0)), Color("ffe4a0"), false, 1.1)
        # Host marks the tiles where the current action works (marker or directly beside it).
        if bool(tile.get("target", false)):
            draw_rect(Rect2(point + Vector2.ONE * 1.5, Vector2.ONE * (cell - 3.0)), Color(TARGET, 0.18))
            draw_rect(Rect2(point + Vector2.ONE * 1.5, Vector2.ONE * (cell - 3.0)), TARGET, false, 2.0)
        receipt.append({"x": x, "y": y, "lit": lit})
    # Roof decoration is derived from wall components, never used for lighting.
    var visited: Dictionary = {}
    for key: Variant in wall_lookup:
        var seed: Vector2i = key
        if visited.has(seed):
            continue
        var pending: Array[Vector2i] = [seed]
        var low: Vector2i = seed
        var high: Vector2i = seed
        while not pending.is_empty():
            var tile: Vector2i = pending.pop_back()
            if visited.has(tile):
                continue
            visited[tile] = true
            low = Vector2i(mini(low.x, tile.x), mini(low.y, tile.y))
            high = Vector2i(maxi(high.x, tile.x), maxi(high.y, tile.y))
            for direction: Vector2i in [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]:
                var neighbor: Vector2i = tile + direction
                if wall_lookup.has(neighbor) and not visited.has(neighbor):
                    pending.append(neighbor)
        for roof_y: int in range(low.y, high.y + 1, 2):
            for roof_x: int in range(low.x, high.x + 1, 2):
                roof(Vector2i(roof_x, roof_y), Vector2i(mini(roof_x + 1, high.x), mini(roof_y + 1, high.y)))
    var route: String = str(frame.get("route", "door"))
    var night: bool = str(frame.get("phase", "")) == "night"
    landmark("home", "Home")
    # On a well night the door is just a house; its label would compete with the well.
    landmark("door", "Their door", not night or route == "door")
    var collect: int = int(ceil(float(frame.get("handoffRemaining", 0)) / 10.0))
    landmark("well", "Danyal collects · %ds" % collect if bool(frame.get("deliveryPending", false)) else "Well box", not night or route == "well")
    var landmarks: Array = frame.get("landmarks", [])
    for entry: Variant in landmarks:
        if entry is Dictionary:
            var kind: String = str(entry.get("kind", ""))
            if kind not in ["home", "door", "well"]:
                draw_landmark(entry, kind, str(entry.get("name", "")))
    var people: Array = frame.get("people", [])
    for index: int in range(people.size()):
        var person: Dictionary = people[index]
        var point: Vector2 = at(float(person.get("x", 0)) + 0.5, float(person.get("y", 0)) + 0.5)
        var reaction: String = str(person.get("reaction", ""))
        var awake: bool = bool(person.get("awake", false))
        if reaction != "" and reaction != "none":
            draw_arc(point, cell * 0.43, -PI * 0.9, PI * 0.7, 20, Color("f3d68d"), 1.5, true)
        figure(point, COATS[index % COATS.size()], bool(person.get("lantern", false)), awake, reaction != "" and reaction != "none")
        # Person names sit above the figure; place labels sit below it.
        var name_size: int = maxi(9, int(cell * 0.35))
        var name_text: String = str(person.get("name", ""))
        var name_width: float = font.get_string_size(name_text, HORIZONTAL_ALIGNMENT_LEFT, -1, name_size).x
        var name_point: Vector2 = point + Vector2(0, -cell * 0.72)
        var name_box: Rect2 = Rect2(name_point - Vector2(name_width / 2.0 + 3, name_size), Vector2(name_width + 6, name_size + 3))
        # Move names above existing place labels instead of covering Well box.
        for attempt: int in range(8):
            var overlaps: bool = false
            for occupied: Rect2 in label_boxes:
                if name_box.grow(2.0).intersects(occupied):
                    overlaps = true
                    break
            if not overlaps:
                break
            var offset: Vector2 = Vector2(0, -name_size - 6)
            name_point += offset
            name_box.position += offset
        label_boxes.append(name_box)
        draw_style_box(make_label_style(), name_box)
        label(name_text, name_point, Color("e1e5df"), name_size)
    var player: Dictionary = frame.get("player", {})
    if not player.is_empty():
        var you: Vector2 = at(float(player.get("x", 0)) + 0.5, float(player.get("y", 0)) + 0.5)
        draw_circle(you, cell * 0.36, Color(YOU, 0.16))
        draw_arc(you, cell * 0.36, 0.0, TAU, 28, YOU, 2.5, true)
        figure(you, Color("e4a74a"), bool(player.get("lantern", false)), true)
        var you_size: int = maxi(10, int(cell * 0.4))
        var you_width: float = font.get_string_size("You", HORIZONTAL_ALIGNMENT_LEFT, -1, you_size).x
        var you_point: Vector2 = you + Vector2(0, -cell * 0.62)
        var you_box: StyleBoxFlat = make_label_style()
        you_box.bg_color = YOU
        draw_style_box(you_box, Rect2(you_point - Vector2(you_width / 2.0 + 4, you_size), Vector2(you_width + 8, you_size + 4)))
        label("You", you_point, INK, you_size)
    # Snowfall is decorative and has no simulation or lighting effect.
    for index: int in range(42):
        var sx: float = fposmod(index * 73.3 + sin(elapsed * 0.4 + index) * 10.0, viewport.x)
        var sy: float = fposmod(index * 97.1 + elapsed * (5.0 + index % 4), viewport.y)
        draw_circle(Vector2(sx, sy), 0.7 if index % 3 else 1.1, Color(0.83, 0.91, 0.97, 0.28))
    if bridge != null:
        bridge.rendered(JSON.stringify(receipt))

func roof(low: Vector2i, high: Vector2i) -> void:
    var point: Vector2 = at(low.x, low.y)
    var extent: Vector2 = Vector2(high.x - low.x + 1, high.y - low.y + 1) * cell
    var rect: Rect2 = Rect2(point + Vector2.ONE * 1.5, extent - Vector2.ONE * 3.0)
    draw_rect(Rect2(rect.position + Vector2(2, 3), rect.size), Color("101c2b"))
    draw_rect(rect, Color("566d80"))
    var ridge: float = rect.position.y + rect.size.y * 0.44
    draw_colored_polygon(PackedVector2Array([rect.position, rect.position + Vector2(rect.size.x, 0), Vector2(rect.end.x, ridge), Vector2(rect.position.x, ridge + 1)]), Color("b1c7d2"))
    draw_line(Vector2(rect.position.x, ridge), Vector2(rect.end.x, ridge), Color("e3e9e6"), 1.5)
    draw_line(rect.position + Vector2(3, 2), rect.position + Vector2(rect.size.x - 3, 2), Color("e4eceb"), 2.0)
    var chimney: Vector2 = rect.position + Vector2(rect.size.x * 0.73, 1)
    draw_rect(Rect2(chimney - Vector2(2, 3), Vector2(4, 7)), Color("758d9c"))
    draw_rect(Rect2(Vector2(rect.get_center().x - cell * 0.1, rect.end.y - cell * 0.22), Vector2(cell * 0.2, cell * 0.16)), Color("d9b775"))

func figure(point: Vector2, coat: Color, lantern: bool, awake: bool, reacting: bool = false) -> void:
    draw_shadow(point)
    draw_circle(point + Vector2(0, cell * 0.03), cell * 0.19, INK)
    draw_circle(point, cell * 0.16, coat)
    var head: Vector2 = point + Vector2(-cell * 0.08 if reacting else (cell * 0.03 if awake else 0.0), -cell * 0.19)
    draw_circle(head, cell * 0.12, Color("e5c1a1"))
    draw_arc(head, cell * 0.12, PI, TAU, 10, INK, cell * 0.06, true)
    if awake:
        draw_circle(head + Vector2(cell * 0.06, 0), cell * 0.022, INK)
    if lantern:
        var lamp: Vector2 = point + Vector2(-cell * 0.25, 0)
        draw_line(point, lamp, coat, 2.0)
        draw_rect(Rect2(lamp - Vector2(2, 3), Vector2(4, 6)), Color("fff0b1"))

func draw_shadow(point: Vector2) -> void:
    draw_circle(point + Vector2(0, cell * 0.16), cell * 0.18, Color(0.02, 0.05, 0.09, 0.7))

func landmark(key: String, title: String, labelled: bool = true) -> void:
    var value: Variant = frame.get(key)
    if not value is Dictionary:
        var landmarks: Array = frame.get("landmarks", [])
        for entry: Variant in landmarks:
            if entry is Dictionary and str(entry.get("kind", "")) == key:
                value = entry
                break
    if not value is Dictionary:
        return
    var place: Dictionary = value
    draw_landmark(place, key, title if labelled else "")

func draw_landmark(place: Dictionary, key: String, title: String) -> void:
    var point: Vector2 = at(float(place.get("x", 0)) + 0.5, float(place.get("y", 0)) + 0.5)
    if key == "door":
        # A high-contrast diamond identifies the actual host delivery tile.
        var radius: float = cell * 0.31
        draw_colored_polygon(PackedVector2Array([point + Vector2(0, -radius), point + Vector2(radius, 0), point + Vector2(0, radius), point + Vector2(-radius, 0)]), Color("fff0b1"))
        draw_circle(point, cell * 0.12, INK)
    elif key == "well":
        draw_circle(point, cell * 0.29, Color("99aeb8"))
        draw_circle(point, cell * 0.19, Color("162c40"))
        draw_line(point + Vector2(-cell * 0.3, -cell * 0.33), point + Vector2(cell * 0.3, -cell * 0.33), Color("c4b99c"), 2.0)
        for side: float in [-0.25, 0.25]:
            draw_line(point + Vector2(cell * side, -cell * 0.33), point + Vector2(cell * side, cell * 0.08), Color("b5a382"), 1.5)
    elif key == "mosque":
        draw_rect(Rect2(point - Vector2(cell * 0.43, cell * 0.15), Vector2(cell * 0.86, cell * 0.47)), Color("a8bec7"))
        draw_circle(point - Vector2(0, cell * 0.15), cell * 0.32, Color("a8bec7"))
        draw_line(point - Vector2(0, cell * 0.55), point - Vector2(0, cell * 0.42), Color("e1c793"), 1.2)
        draw_rect(Rect2(point + Vector2(cell * 0.39, -cell * 0.7), Vector2(cell * 0.13, cell)), Color("b6c9cf"))
    if title == "":
        return
    # Yusuf's "You" label sits above him; skip a place label he is standing on.
    var player: Dictionary = frame.get("player", {})
    var below: int = int(player.get("y", -9)) - int(place.get("y", 0))
    if absi(int(player.get("x", -9)) - int(place.get("x", 0))) <= 1 and below >= 1 and below <= (2 if key == "well" else 1):
        return
    var text_size: int = maxi(10, int(cell * 0.38))
    var text_width: float = font.get_string_size(title, HORIZONTAL_ALIGNMENT_LEFT, -1, text_size).x
    var center: Vector2 = point + Vector2(0, cell * (1.45 if key == "well" else 0.84))
    center.x = clampf(center.x, origin.x + text_width / 2.0 + 3, origin.x + cell * map_width - text_width / 2.0 - 3)
    var box: Rect2 = Rect2(center - Vector2(text_width / 2.0 + 4, text_size), Vector2(text_width + 8, text_size + 4))
    label_boxes.append(box)
    draw_style_box(make_label_style(), box)
    label(title, center, Color("f0dfb9"), text_size)

func make_label_style() -> StyleBoxFlat:
    var style: StyleBoxFlat = StyleBoxFlat.new()
    style.bg_color = Color(0.035, 0.07, 0.12, 0.9)
    style.corner_radius_top_left = 3
    style.corner_radius_top_right = 3
    style.corner_radius_bottom_left = 3
    style.corner_radius_bottom_right = 3
    return style
