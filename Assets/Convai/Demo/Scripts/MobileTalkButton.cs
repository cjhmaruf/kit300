using UnityEngine;
using UnityEngine.EventSystems;
using Convai.Scripts.Runtime.Core;

namespace Convai.Demo.Scripts
{
    /// <summary>
    /// Lets a UI Button act as a push-to-talk control for touch/mobile users,
    /// since ConvaiInputManager's talk action is normally only bound to the
    /// keyboard "T" key (no on-screen equivalent exists by default).
    ///
    /// IMPORTANT: this deliberately calls ConvaiNPC.StartListening()/StopListening()
    /// directly instead of going through ConvaiInputManager.talkKeyInteract.
    /// That event is consumed by PlayerInteractionManager.HandleVoiceInput, which
    /// starts with:
    ///   if (... || EventSystem.current.IsPointerOverGameObject()) return;
    /// That guard exists to stop the talk key from firing while the player is
    /// interacting with UI (chat box, settings, etc). But it also silently
    /// swallows input from this button, since pressing it means the pointer
    /// is - by definition - over a UI element. Result: StartListening() never
    /// runs, no audio gets recorded, and the app falls back to showing
    /// "Talk Button Released Early" once you lift your finger.
    /// Calling the NPC directly sidesteps that guard entirely.
    /// </summary>
    public class MobileTalkButton : MonoBehaviour, IPointerDownHandler, IPointerUpHandler
    {
        private ConvaiNPC GetActiveNPC()
        {
            return ConvaiNPCManager.Instance != null ? ConvaiNPCManager.Instance.activeConvaiNPC : null;
        }

        public void OnPointerDown(PointerEventData eventData)
        {
            var npc = GetActiveNPC();
            if (npc != null)
            {
                npc.StartListening();
            }
            else
            {
                Debug.LogWarning("[MobileTalkButton] No active NPC to talk to yet - get closer to a character first.");
            }
        }

        public void OnPointerUp(PointerEventData eventData)
        {
            var npc = GetActiveNPC();
            if (npc != null)
            {
                npc.StopListening();
            }
        }
    }
}
