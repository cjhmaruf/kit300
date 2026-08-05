using UnityEngine;
using UnityEngine.UI;

namespace Convai.Scripts.Runtime.Addons
{
    /// <summary>
    ///     Handles the pre-exam character selection screen, letting the student choose
    ///     between the available examiner avatars before the exam begins.
    /// </summary>
    [AddComponentMenu("Convai/Character Selection Manager")]
    public class CharacterSelectionManager : MonoBehaviour
    {
        [Header("Character References")]
        [Tooltip("The female examiner character (e.g. Amelia).")]
        [SerializeField] private GameObject femaleCharacter;

        [Tooltip("The male examiner character (e.g. Steve).")]
        [SerializeField] private GameObject maleCharacter;

        [Header("UI References")]
        [Tooltip("The selection screen canvas shown before the exam begins.")]
        [SerializeField] private GameObject selectionCanvas;

        [SerializeField] private Button selectFemaleButton;
        [SerializeField] private Button selectMaleButton;

        private void Awake()
        {
            // Hide both characters until the student makes a choice.
            if (femaleCharacter != null) femaleCharacter.SetActive(false);
            if (maleCharacter != null) maleCharacter.SetActive(false);

            if (selectionCanvas != null) selectionCanvas.SetActive(true);
        }

        private void Start()
        {
            if (selectFemaleButton != null) selectFemaleButton.onClick.AddListener(SelectFemale);
            if (selectMaleButton != null) selectMaleButton.onClick.AddListener(SelectMale);
        }

        /// <summary>
        ///     Activates the female examiner character and hides the selection screen.
        /// </summary>
        public void SelectFemale()
        {
            if (femaleCharacter != null) femaleCharacter.SetActive(true);
            if (maleCharacter != null) maleCharacter.SetActive(false);
            if (selectionCanvas != null) selectionCanvas.SetActive(false);
        }

        /// <summary>
        ///     Activates the male examiner character and hides the selection screen.
        /// </summary>
        public void SelectMale()
        {
            if (maleCharacter != null) maleCharacter.SetActive(true);
            if (femaleCharacter != null) femaleCharacter.SetActive(false);
            if (selectionCanvas != null) selectionCanvas.SetActive(false);
        }
    }
}
