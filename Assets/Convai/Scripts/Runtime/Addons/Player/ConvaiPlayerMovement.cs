using Convai.Scripts.Runtime.Core;
using Convai.Scripts.Runtime.UI;
using UnityEngine;

using UnityEngine.InputSystem;
using UnityEngine.EventSystems;

namespace Convai.Scripts.Runtime.Addons
{
    /// <summary>
    ///     Class for handling player movement including walking, running, jumping, and looking around.
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    [DisallowMultipleComponent]
    [AddComponentMenu("Convai/Player Movement")]
    public class ConvaiPlayerMovement : MonoBehaviour
    {
        [Header("Movement Parameters")] [SerializeField] [Tooltip("The speed at which the player walks.")] [Range(1, 10)]
        private float walkingSpeed = 3f;

        [SerializeField] [Tooltip("The speed at which the player runs.")] [Range(1, 10)]
        private float runningSpeed = 8f;

        [SerializeField] [Tooltip("The speed at which the player jumps.")] [Range(1, 10)]
        private float jumpSpeed = 4f;

        [Header("Gravity & Grounding")] [SerializeField] [Tooltip("The gravity applied to the player.")] [Range(1, 10)]
        private float gravity = 9.8f;

        [Header("Camera Parameters")] [SerializeField] [Tooltip("The main camera the player uses.")]
        private Camera playerCamera;

        [SerializeField] [Tooltip("Speed at which the player can look around.")] [Range(0, 1)]
        private float lookSpeedMultiplier = 0.05f;

        [SerializeField] [Tooltip("Limit of upwards and downwards look angles.")] [Range(1, 90)]
        private float lookXLimit = 45.0f;

        private CharacterController _characterController;
        private Vector3 _moveDirection = Vector3.zero;
        private float _rotationX;
        private float _rotationY;


        //Singleton Instance
        public static ConvaiPlayerMovement Instance { get; private set; }

        private void Awake()
        {
            // Singleton pattern to ensure only one instance exists
            if (Instance == null)
                Instance = this;
            else
                Destroy(gameObject);
        }

        private void Start()
        {
            _characterController = GetComponent<CharacterController>();
        }

        private void Update()
        {
            // Check for running state and move the player
            MovePlayer();

            // Handle the player and camera rotation
            RotatePlayerAndCamera();
        }

        private void OnEnable()
        {
            ConvaiInputManager.Instance.jumping += Jump;
        }


private void MovePlayer()
        {
            // Movement disabled: player is locked in place for a static face-to-face interaction.
            if (!_characterController.isGrounded)
                _moveDirection.y -= gravity * Time.deltaTime;
            else
                _moveDirection.y = 0f;

            _characterController.Move(_moveDirection * Time.deltaTime);
        }

        private void Jump()
        {
            if (_characterController.isGrounded && !UIUtilities.IsAnyInputFieldFocused()) _moveDirection.y = jumpSpeed;
        }

private void RotatePlayerAndCamera()
        {
            if (UIUtilities.IsAnyInputFieldFocused()) return;

            Vector2 mouseDelta = Mouse.current != null ? Mouse.current.delta.ReadValue() : Vector2.zero;

            float mouseX = mouseDelta.x * lookSpeedMultiplier * 0.1f;
            float mouseY = mouseDelta.y * lookSpeedMultiplier * 0.1f;

            _rotationX -= mouseY;
            _rotationX = Mathf.Clamp(_rotationX, -lookXLimit, lookXLimit);

            if (playerCamera != null)
            {
                playerCamera.transform.localRotation =
                    Quaternion.Euler(_rotationX, 0f, 0f);
            }

            transform.Rotate(Vector3.up * mouseX);
        }
    }
}