// Minimal no-op sound/music backend for the widget build.
// i_sound.c's module table (sound_modules[]) references DG_sound_module and
// DG_music_module by name unconditionally; normally these live in
// i_sdlsound.c/i_sdlmusic.c. We skip SDL entirely for this build, so this
// file provides the same two symbols wired to no-ops (Init returns false,
// so i_sound.c's sound_module/music_module pointers stay NULL and every
// call site's "if (sound_module != NULL)" guard short-circuits).

#include <stddef.h>
#include "i_sound.h"

static boolean Null_InitSound(boolean use_sfx_prefix) { return false; }
static void Null_ShutdownSound(void) {}
static int Null_GetSfxLumpNum(sfxinfo_t *sfxinfo) { return 0; }
static void Null_Update(void) {}
static void Null_UpdateSoundParams(int channel, int vol, int sep) {}
static int Null_StartSound(sfxinfo_t *sfxinfo, int channel, int vol, int sep) { return -1; }
static void Null_StopSound(int channel) {}
static boolean Null_SoundIsPlaying(int channel) { return false; }
static void Null_CacheSounds(sfxinfo_t *sounds, int num_sounds) {}

sound_module_t DG_sound_module =
{
    NULL, 0,
    Null_InitSound,
    Null_ShutdownSound,
    Null_GetSfxLumpNum,
    Null_Update,
    Null_UpdateSoundParams,
    Null_StartSound,
    Null_StopSound,
    Null_SoundIsPlaying,
    Null_CacheSounds,
};

static boolean Null_InitMusic(void) { return false; }
static void Null_ShutdownMusic(void) {}
static void Null_SetMusicVolume(int volume) {}
static void Null_PauseMusic(void) {}
static void Null_ResumeMusic(void) {}
static void *Null_RegisterSong(void *data, int len) { return NULL; }
static void Null_UnRegisterSong(void *handle) {}
static void Null_PlaySong(void *handle, boolean looping) {}
static void Null_StopSong(void) {}
static boolean Null_MusicIsPlaying(void) { return false; }
static void Null_PollMusic(void) {}

music_module_t DG_music_module =
{
    NULL, 0,
    Null_InitMusic,
    Null_ShutdownMusic,
    Null_SetMusicVolume,
    Null_PauseMusic,
    Null_ResumeMusic,
    Null_RegisterSong,
    Null_UnRegisterSong,
    Null_PlaySong,
    Null_StopSong,
    Null_MusicIsPlaying,
    Null_PollMusic,
};
