#!/bin/bash
set -e
cd "$(dirname "$0")"

SRC_DOOM="dummy am_map doomdef doomstat dstrings d_event d_items d_iwad d_loop d_main d_mode d_net f_finale f_wipe g_game hu_lib hu_stuff info i_cdmus i_endoom i_joystick i_scale i_sound i_system i_timer memio m_argv m_bbox m_cheat m_config m_controls m_fixed m_menu m_misc m_random p_ceilng p_doors p_enemy p_floor p_inter p_lights p_map p_maputl p_mobj p_plats p_pspr p_saveg p_setup p_sight p_spec p_switch p_telept p_tick p_user r_bsp r_data r_draw r_main r_plane r_segs r_sky r_things sha1 sounds statdump st_lib st_stuff s_sound tables v_video wi_stuff w_checksum w_file w_main w_wad z_zone w_file_stdc i_input i_video doomgeneric mus2mid"

OBJDIR=build_widget
OUTPUT=doomwidget

CFLAGS="-O2 -DDOOMGENERIC_RESX=320 -DDOOMGENERIC_RESY=200 -DFEATURE_SOUND -sUSE_SDL=2 -sUSE_SDL_MIXER=2"
EMFLAGS="-s ALLOW_MEMORY_GROWTH=1 -s EXPORTED_RUNTIME_METHODS=[\"ccall\",\"cwrap\",\"HEAPU8\",\"HEAP32\"] -s EXPORTED_FUNCTIONS=[\"_main\",\"_DG_AddKey\",\"_DG_ListMonsters\",\"_DG_TagMonster\",\"_malloc\",\"_free\"] -s MODULARIZE=1 -s EXPORT_NAME=createDoomWidgetModule -s ENVIRONMENT=web -sUSE_SDL=2 -sUSE_SDL_MIXER=2 -sSDL2_MIXER_FORMATS=[\"mid\"] --preload-file doom1.wad"

# Always a full clean rebuild — no header-dependency tracking here, and an
# incremental build silently mixed old/new mobj_t layouts across object files
# once already (adding a struct field to p_mobj.h without touching the .c
# files that use it left their .o stale, corrupting memory at runtime in a
# way that looked exactly like an infinite loop). This project is small
# enough that a full rebuild costs a few seconds — not worth the risk.
rm -rf "$OBJDIR"
mkdir -p "$OBJDIR"

OBJS=""
for f in $SRC_DOOM i_sdlsound i_sdlmusic gusconf doomgeneric_widget; do
    obj="$OBJDIR/$f.o"
    OBJS="$OBJS $obj"
    if [ -f "$f.c" ]; then
        src="$f.c"
    else
        echo "MISSING SOURCE: $f.c" >&2
        exit 1
    fi
    echo "[cc] $src"
    emcc $CFLAGS -c "$src" -o "$obj"
done

echo "[link] $OUTPUT"
emcc $CFLAGS $EMFLAGS $OBJS -o "$OUTPUT.js" -lm -lc

echo "BUILD OK"
ls -la "$OUTPUT".js "$OUTPUT".wasm "$OUTPUT".data 2>/dev/null
