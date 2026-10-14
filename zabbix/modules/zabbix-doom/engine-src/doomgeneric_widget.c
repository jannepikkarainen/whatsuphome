// doomgeneric platform layer for the Zabbix "DOOM: Alert Slayer" widget.
// No SDL: presents DG_ScreenBuffer straight to a JS-managed canvas, and
// takes key events pushed in from JS (DG_AddKey) instead of polling any
// local input device.

#include "doomgeneric.h"
#include "doomkeys.h"
#include "m_argv.h"
#include "p_local.h"

#include <emscripten.h>
#include <stdint.h>

#define KEYQUEUE_SIZE 32
static unsigned short s_KeyQueue[KEYQUEUE_SIZE];
static unsigned int s_KeyQueueWriteIndex = 0;
static unsigned int s_KeyQueueReadIndex = 0;

// Module.HEAPU8 is NOT how this build config exposes the heap view — it's a
// plain global (see build_widget.sh's non-MODULARIZE output). Cost 2+ hours
// to track down: the exception from accessing the wrong one was swallowed as
// an unhandled promise rejection inside emscripten_set_main_loop's internal
// scheduling, which silently killed the next-frame callback with no visible
// crash — looked exactly like a hang.
EM_JS(void, js_present_frame, (void *buf, int w, int h), {
    if (typeof Module.dgPresentFrame === 'function') {
        Module.dgPresentFrame(buf, w, h);
    }
});

void DG_Init()
{
}

void DG_DrawFrame()
{
    js_present_frame(DG_ScreenBuffer, DOOMGENERIC_RESX, DOOMGENERIC_RESY);
}

void DG_SleepMs(uint32_t ms)
{
    // emscripten_set_main_loop already paces ticks via requestAnimationFrame;
    // a real blocking sleep here would need Asyncify, so this is a no-op.
}

uint32_t DG_GetTicksMs()
{
    return (uint32_t) emscripten_get_now();
}

int DG_GetKey(int* pressed, unsigned char* doomKey)
{
    if (s_KeyQueueReadIndex == s_KeyQueueWriteIndex)
    {
        return 0;
    }

    unsigned short keyData = s_KeyQueue[s_KeyQueueReadIndex];
    s_KeyQueueReadIndex++;
    s_KeyQueueReadIndex %= KEYQUEUE_SIZE;

    *pressed = keyData >> 8;
    *doomKey = keyData & 0xFF;
    return 1;
}

void DG_SetWindowTitle(const char * title)
{
}

// Called from JS with an already-translated DOOM keycode (see doomkeys.h).
EMSCRIPTEN_KEEPALIVE
void DG_AddKey(int pressed, int doomKey)
{
    unsigned short keyData = ((pressed ? 1 : 0) << 8) | (doomKey & 0xFF);
    s_KeyQueue[s_KeyQueueWriteIndex] = keyData;
    s_KeyQueueWriteIndex++;
    s_KeyQueueWriteIndex %= KEYQUEUE_SIZE;
}

/* ── Zabbix alert <-> monster linking ───────────────────────────────
   Real DOOM's monster roster is fixed by the map, so alerts get linked
   to whatever untagged live monsters currently exist rather than being
   spawned fresh. dg_alertTag (added to mobj_t, see p_mobj.h) is 0 for
   an ordinary monster; JS sets it via DG_TagMonster() after picking one
   from DG_ListMonsters(), and P_KillMobj (p_inter.c) reports it back via
   DG_NotifyMonsterKilled() the moment that specific monster dies. ────── */

// Lists live, untagged, killable monsters. Caller-owned int arrays.
EMSCRIPTEN_KEEPALIVE
int DG_ListMonsters(int *outIds, int *outTypes, int *outHealths, int maxCount)
{
    int n = 0;
    int scanned = 0;
    thinker_t *th;

    // Sanity cap: thinkercap.next stays &thinkercap (empty list) until a
    // level is actually loaded (title/demo screen has no thinkers at all),
    // so this is always a genuinely short walk in practice — the cap is
    // just to guarantee this can never hang if that ever isn't true.
    for (th = thinkercap.next; th != &thinkercap && n < maxCount && scanned < 10000; th = th->next)
    {
        scanned++;
        if (th->function.acp1 != (actionf_p1) P_MobjThinker)
            continue;

        mobj_t *mo = (mobj_t *) th;
        if (!(mo->flags & MF_COUNTKILL))
            continue;
        if (mo->flags & MF_CORPSE)
            continue;
        if (mo->health <= 0)
            continue;
        if (mo->dg_alertTag != 0)
            continue;

        outIds[n] = (int) (intptr_t) mo;
        outTypes[n] = (int) mo->type;
        outHealths[n] = mo->health;
        n++;
    }

    return n;
}

// Links a monster (by the id DG_ListMonsters just handed out) to an alert tag.
// Trusts the caller to only pass ids from this tick's DG_ListMonsters call —
// there is no way to validate a raw pointer from here.
EMSCRIPTEN_KEEPALIVE
void DG_TagMonster(int id, int tag)
{
    mobj_t *mo = (mobj_t *) (intptr_t) id;
    mo->dg_alertTag = tag;
}

EM_JS(void, DG_NotifyMonsterKilled, (int tag), {
    if (typeof Module.dgOnMonsterKilled === 'function') {
        Module.dgOnMonsterKilled(tag);
    }
});

int main(int argc, char **argv)
{
    // -warp sets autostart=true, which skips the title screen/menu entirely
    // and drops straight into E1M1 gameplay — no menu-navigation input
    // sequence needed (and nothing to fumble in a small dashboard widget).
    // Episode AND map must both be given explicitly for non-commercial (Doom
    // 1) mode: with only one number, d_main.c's -warp handler reads the next
    // argv slot as the map number regardless of what it actually is — here
    // that would've been "-skill" ('-' - '0' = -3), silently warping to a
    // bogus negative map number instead of defaulting cleanly to map 1.
    static char *widgetArgv[] = { "doomgeneric", "-warp", "1", "1", "-skill", "3" };
    doomgeneric_Create(sizeof(widgetArgv) / sizeof(widgetArgv[0]), widgetArgv);
    emscripten_set_main_loop(doomgeneric_Tick, 0, 1);
    return 0;
}
