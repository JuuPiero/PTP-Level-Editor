import React, { useState, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';

const baseBehaviourContext = `using System;
using System.Collections.Generic;
using UnityEngine;
using Object = UnityEngine.Object;

public class BaseBehaviour : MonoBehaviour
{
    private static readonly Dictionary<Type, object> FindDictionary = new Dictionary<Type, object>();
    private readonly Dictionary<Type, object> GetDictionary = new Dictionary<Type, object>();
    private readonly Dictionary<Type, object> GetChildDictionary = new Dictionary<Type, object>();
    private readonly Dictionary<string, object> CreateIfNotExistDictionary = new Dictionary<string, object>();

    protected static T SingleFind<T>() where T : Object
    {
        var type = typeof(T);
        if (!FindDictionary.ContainsKey(type)) FindDictionary[type] = FindObjectOfType<T>();
        return (T) FindDictionary[type];
    }

    protected T SingleGet<T>() where T : Object
    {
        var type = typeof(T);
        if (!GetDictionary.ContainsKey(type)) GetDictionary[type] = GetComponent<T>();
        return (T) GetDictionary[type];
    }

    protected T SingleGetChild<T>(bool includeInactive = true) where T : Object
    {
        var type = typeof(T);
        if (!GetChildDictionary.ContainsKey(type))
            GetChildDictionary[type] = GetComponentInChildren<T>(includeInactive);
        return (T) GetChildDictionary[type];
    }

    protected T SingleCreateIfNotExist<T>(string customName, Func<T> createFunc)
    {
        return SingleCreateIfNotExist(createFunc, customName);
    }

    protected T SingleCreateIfNotExist<T>(Func<T> createFunc, string customName = null)
    {
        var dictKey = typeof(T).ToString();
        if (!string.IsNullOrEmpty(customName)) dictKey = customName;
        if (!CreateIfNotExistDictionary.ContainsKey(dictKey)) CreateIfNotExistDictionary[dictKey] = createFunc();
        return (T) CreateIfNotExistDictionary[dictKey];
    }

    public void SetSingleCreateIfNotExist<T>(T obj, string customName = null)
    {
        var dictKey = typeof(T).ToString();
        if (!string.IsNullOrEmpty(customName)) dictKey = customName;
        CreateIfNotExistDictionary[dictKey] = obj;
    }

    public T GetSingleCreate<T>(string customName = null) where T : Object
    {
        var dictKey = typeof(T).ToString();
        if (!string.IsNullOrEmpty(customName)) dictKey = customName;
        if (CreateIfNotExistDictionary.TryGetValue(dictKey, out var obj))
        {
            return (T)obj;
        }
        return null;
    }

    protected void SingleClear<T>()
    {
        var type = typeof(T);
        var typeStr = type.ToString();
        if (CreateIfNotExistDictionary.ContainsKey(typeStr))
        {
            CreateIfNotExistDictionary.Remove(typeStr);
        }
        if (FindDictionary.ContainsKey(type))
        {
            FindDictionary.Remove(type);
        }
    }

    protected void SingleClear(string customName)
    {
        if (CreateIfNotExistDictionary.ContainsKey(customName))
        {
            CreateIfNotExistDictionary.Remove(customName);
        }
    }

    protected void SingleClearCreateIfNotExist()
    {
        CreateIfNotExistDictionary.Clear();
    }

    protected void SingleClearFind()
    {
        FindDictionary.Clear();
    }
}
`;

const gridInputHandlerContext = `using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Serialization;

namespace IEC
{
    public class GridInputHandler : _BaseBehaviour
    {
        private GridManager GridManager => InGame.gridManager;

        // for game play handle
        private bool _isDragging;
        private bool _isDragTail;
        private SnakeObject _currentSelectSnake;
        private Vector3 _offsetMouse;
        private Vector3 _lastMousePosition;

        private GridTile _currentHitTile;

        private void Start()
        {
            EventController.AddObserver(EventList.InGame.SnakeMoveOut, StopDragging);
        }

        private void Update()
        {
            HandleInput();
            // if (_currentSelectSnake == null) return;

            // if (Input.GetKeyDown(KeyCode.Keypad8))
            // {
            //     StartCoroutine(_currentSelectSnake.ExecuteSingleMove(Vector2Int.up));
            // }
            // if (Input.GetKeyDown(KeyCode.Keypad2))
            // {
            //     StartCoroutine(_currentSelectSnake.ExecuteSingleMove(Vector2Int.down));
            // }
            // if (Input.GetKeyDown(KeyCode.Keypad4))
            // {
            //     StartCoroutine(_currentSelectSnake.ExecuteSingleMove(Vector2Int.left));
            // }
            // if (Input.GetKeyDown(KeyCode.Keypad6))
            // {
            //     StartCoroutine(_currentSelectSnake.ExecuteSingleMove(Vector2Int.right));
            // }

            if (Input.GetKeyDown(KeyCode.A))
            {
                foreach (var occupiedTile in _currentSelectSnake.listOccupiedTiles)
                {
                    Debug.Log("---> " + occupiedTile.gridPos);
                }
            }
        }

        #region Handle Input

        private void HandleInput()
        {
            // Check if any popup is showing - if so, don't handle input
            if (UI.hasPopupShowed)
            {
                return;
            }

            if (InGame.gameState == GameState.Playing)
            {
                HandleDragSnake();
                return;
            }

            if (InGame.gameState == GameState.UsingHelper && InGame.UsingHelper == ResourceType.Grabber)
            {
                if (Input.GetMouseButtonDown(0))
                {
                    var snake = GetSnakeInput();
                    if (!snake || !snake.CanGrab())
                    {
                        return;
                    }

                    GridManager.GrabSnake(snake);
                }
            }
        }

        private void HandleDragSnake()
        {
            if (Input.GetMouseButtonDown(0))
            {
                TryStartDragging();
            }
            else if (Input.GetMouseButtonUp(0) && _isDragging)
            {
                StopDragging();
            }
            else if (_isDragging)
            {
                OnDrag();
            }
            
        }

        private SnakeObject GetSnakeInput()
        {
            var mouseWorldPos = GridManager.GetMouseWorldPosition();
            var gridTile = GridManager.GetNearestValidGridTile(mouseWorldPos);
            if (!gridTile || gridTile.status != GridStatus.Pet) return null;
            var snake = gridTile.snakeObject;
            if (!snake || !snake.CanMove()) return null;
            return snake;
        }

        private (SnakeObject, GridTile) GetSnakeNearestInput()
        {
            var mouseWorldPos = GridManager.GetMouseWorldPosition();
            var gridTile = GridManager.GetNearestValidGridTile(mouseWorldPos);
            if (!gridTile || gridTile.movableObject) return (null, null);

            foreach (var direction in InGame.gridManager.GetPositionAroundPosition(gridTile.gridPos))
            {
                var expandGrid = GridManager.GetGridTile(gridTile.gridPos + direction);
                if (!expandGrid || expandGrid.status != GridStatus.Pet) continue;
                var snake = expandGrid.snakeObject;
                if (!snake || !snake.CanMove()) continue;

                var index = snake.listOccupiedTiles.IndexOf(expandGrid);
                if (index != 0 && index != snake.listOccupiedTiles.Count - 1) continue;
                return (snake, expandGrid);
            }

            return (null, null);
        }

        private void TryStartDragging()
        {
            var mouseWorldPos = GridManager.GetMouseWorldPosition();
            var gridTile = GridManager.GetNearestValidGridTile(mouseWorldPos);
            _currentSelectSnake = GetSnakeInput();
            if (!_currentSelectSnake)
            {
                var infoAround = GetSnakeNearestInput();
                _currentSelectSnake = infoAround.Item1;
                if (!_currentSelectSnake) return;
                gridTile = infoAround.Item2;
                if (!gridTile) return;
            }

            // Debug.Log($"select snake: {_currentSelectSnake.name} -> grid pos: {gridTile.gridPos}");
            EventController.Notify(EventList.InGame.SelectSnake);
            _isDragging = true;
            var index = _currentSelectSnake.listOccupiedTiles.IndexOf(gridTile);
            _isDragTail = index > _currentSelectSnake.listOccupiedTiles.Count / 2;
            _lastMousePosition = mouseWorldPos;
        }

        private void OnDrag()
        {
            if (!_isDragging) return;
            if (!_currentSelectSnake) return;
            if (_currentSelectSnake.IsMoving) return;
            if (_currentSelectSnake.IsDone) return;

            var mousePos = GridManager.GetMouseWorldPosition();
            _offsetMouse = mousePos - _lastMousePosition;
            var targetTile = GridManager.GetNearestValidGridTile(mousePos);

            var targetTileIsSnapTile = false;
            if (!targetTile || !targetTile.CanMoveInForInput(_currentSelectSnake))
            {
                // smart find tile
                targetTile = GetSnapTileWithMouseOffset();
                targetTileIsSnapTile = targetTile;
            }

            if (!targetTile)
            {
                _currentSelectSnake.AlignBodyToGrid();
                return;
            }

            if (targetTile.CanMoveIn(_currentSelectSnake))
            {
                // Debug.Log("move normal");
                NormalMoveSnake(targetTile);
                return;
            }

            if (targetTile.status == GridStatus.Pet)
            {
                if (_currentSelectSnake.IsContainTile(targetTile))
                {
                    var index = _currentSelectSnake.listOccupiedTiles.IndexOf(targetTile);
                    var current = !_isDragTail ? 0 : _currentSelectSnake.listOccupiedTiles.Count;
                    var offset = Math.Abs(index - current);
                    // Debug.Log($"index: {index}, current: {current}, offset: {offset}");

                    if (offset > 2)
                    {
                        _currentSelectSnake.AlignBodyToGrid();
                        return;
                    }

                    //todo: find the reverse target tile
                    var moveBackTile = GetMoveBackTile(_isDragTail);
                    if (moveBackTile && moveBackTile.CanMoveIn(_currentSelectSnake))
                    {
                        ReverseMoveSnake(moveBackTile);
                        return;
                    }
                }
            }

            if (_currentSelectSnake.IsMoving)
                return; // Wait for grid movement to complete before allowing cursor following
    
            FollowCursorMoveSnake(targetTile, targetTileIsSnapTile);
        }

        private void StopDragging()
        {
            _isDragging = false;
            if (_currentSelectSnake)
            {
                // _currentSelectSnake.AlignBodyToGrid();
                _currentSelectSnake.OnStopDrag();
            }

            _currentSelectSnake = null;
        }
        

        private GridTile GetSnapTileWithMouseOffset(bool normalizeOffset = false, bool alsoCheckInvertedOffset = true)
        {
            var currentInteractTile =
                _isDragTail ? _currentSelectSnake.GetTailTile() : _currentSelectSnake.GetHeadTile();
            if (!currentInteractTile) return null;
            var offsetMouse = GridManager.GetMouseWorldPosition() - currentInteractTile.transform.position;
            return GetSnapTileWithMouseOffset(offsetMouse, currentInteractTile, normalizeOffset,
                alsoCheckInvertedOffset);
        }

        private GridTile GetSnapTileWithMouseOffset(Vector3 offsetMouse, GridTile currentInteractTile = null,
            bool normalizeOffset = false, bool alsoCheckInvertedOffset = true)
        {
            currentInteractTile ??= _isDragTail ? _currentSelectSnake.GetTailTile() : _currentSelectSnake.GetHeadTile();

            var offsetCheck = normalizeOffset ? GetDirectionNormalized(offsetMouse) : GetDirection(offsetMouse);

            var normalCandidate = GridManager.GetNearestValidGridTile(currentInteractTile.gridPos + offsetCheck);
            if (!alsoCheckInvertedOffset)
                return normalCandidate;
            if (normalCandidate && normalCandidate != currentInteractTile &&
                normalCandidate.CanMoveInForInput(_currentSelectSnake))
            {
                return normalCandidate;
            }

            offsetCheck = normalizeOffset
                ? GetDirectionNormalizedInverted(offsetMouse)
                : GetDirectionInverted(offsetMouse);
            var invertedCandidate = GridManager.GetNearestValidGridTile(currentInteractTile.gridPos + offsetCheck);
            if (invertedCandidate && invertedCandidate != currentInteractTile &&
                invertedCandidate.CanMoveInForInput(_currentSelectSnake))
            {
                return invertedCandidate;
            }

            return normalCandidate;
        }

        private GridTile GetMoveBackTile(bool isDragTail, bool normalizeOffset = false)
        {
            var currentInteractTile =
                isDragTail ? _currentSelectSnake.GetTailTile() : _currentSelectSnake.GetHeadTile();

            var offsetMouse = GridManager.GetMouseWorldPosition() - currentInteractTile.transform.position;
            var anchorTile = isDragTail ? _currentSelectSnake.GetHeadTile() : _currentSelectSnake.GetTailTile();
            var mouseDir = normalizeOffset ? GetDirectionNormalized(offsetMouse) : GetDirection(offsetMouse);

            if (mouseDir == Vector2Int.zero) return null;

            var offsetCheck = isDragTail
                ? _currentSelectSnake.GetHeadDirection()
                : _currentSelectSnake.GetTailDirection();
            var checkTile = GridManager.GetGridTile(anchorTile.gridPos + offsetCheck);
            if (checkTile && checkTile.CanMoveIn(_currentSelectSnake))
            {
                return checkTile;
            }

            // Debug.Log("can not found forward tile -> find remain tile ");

            var listDirection = new List<Vector2Int>()
            {
                Vector2Int.up,
                Vector2Int.right,
                Vector2Int.down,
                Vector2Int.left,
            };
            listDirection.Remove(offsetCheck);

            // Ưu tiên tìm về hướng bên phải so với offsetCheck
            var rightDirection = GetRightDirection(offsetCheck);
            if (listDirection.Contains(rightDirection))
            {
                var rightTile = GridManager.GetGridTile(anchorTile.gridPos + rightDirection);
                if (rightTile && rightTile.CanMoveIn(_currentSelectSnake))
                {
                    return rightTile;
                }
            }

            // Nếu không tìm thấy hướng bên phải, kiểm tra các hướng còn lại
            for (var index = 0; index < listDirection.Count; index++)
            {
                var dir = listDirection[index];
                var secondCheckTile = GridManager.GetGridTile(anchorTile.gridPos + dir);
                if (!secondCheckTile || !secondCheckTile.CanMoveIn(_currentSelectSnake)) continue;
                return secondCheckTile;
            }

            return null;
        }

        private Vector2Int GetRightDirection(Vector2Int direction)
        {
            // Trả về hướng bên phải so với direction
            if (direction == Vector2Int.up) return Vector2Int.right;
            if (direction == Vector2Int.right) return Vector2Int.down;
            if (direction == Vector2Int.down) return Vector2Int.left;
            if (direction == Vector2Int.left) return Vector2Int.up;
            return Vector2Int.zero;
        }

        private void NormalMoveSnake(GridTile targetTile)
        {
            if (!targetTile) return;
            if (targetTile.CanMoveIn(_currentSelectSnake))
            {
                _currentSelectSnake.TryMoveToEmptyTile(targetTile, _isDragTail);
            }
        }

        private void ReverseMoveSnake(GridTile targetTile)
        {
            if (!targetTile) return;
            if (targetTile.CanMoveIn(_currentSelectSnake))
            {
                _currentSelectSnake.TryMoveToEmptyTile(targetTile, !_isDragTail);
            }
        }


        private void FollowCursorMoveSnake(GridTile targetTile, bool isSnapTile)
        {
            if (!targetTile.CanMoveIn(_currentSelectSnake))
            {
                var currentInteractTile =
                    _isDragTail ? _currentSelectSnake.GetTailTile() : _currentSelectSnake.GetHeadTile();
                if (isSnapTile)
                    targetTile = currentInteractTile;
                if (currentInteractTile != targetTile)
                    return;

                var offsetMouse = GridManager.GetMouseWorldPosition() - currentInteractTile.transform.position;
                if (isSnapTile)
                {
                    var absX = Math.Abs(offsetMouse.x);
                    var absZ = Math.Abs(offsetMouse.z);
                    if (absX > 0.5f && absX > absZ)
                    {
                        offsetMouse.x = 0f;
                    }
                    else if (absZ > 0.5f && absZ > absX)
                    {
                        offsetMouse.z = 0f;
                    }
                }

                offsetMouse = Vector3.ClampMagnitude(offsetMouse, 0.49999f);
                // offsetMouse.x = 0;

                var offsetCheck = new Vector2(offsetMouse.x, offsetMouse.z);

                if (offsetCheck.sqrMagnitude < 0.0025f)
                    return;
                
                var occupiedTiles = _currentSelectSnake.listOccupiedTiles;
                var currentInteractTileIndex = occupiedTiles.IndexOf(currentInteractTile);
                var adjacentInteractTile =
                    occupiedTiles[_isDragTail ? currentInteractTileIndex - 1 : currentInteractTileIndex + 1];
                var targetTileToAdjacent = adjacentInteractTile.gridPos - targetTile.gridPos;
                var offsetPos = targetTile.gridPos + offsetCheck;
                var isNormalMove = Vector2.Dot(offsetPos - targetTile.gridPos,
                    targetTileToAdjacent) < 0;

                // todo: use getmovebacktile for special case to determine in moving back scenarios, where to that point be
                // use isNormalMove to determine
                if (!isNormalMove)
                {
                    targetTile = occupiedTiles[occupiedTiles.Count - 1 - occupiedTiles.IndexOf(targetTile)];
                    int targetTileIndex = occupiedTiles.IndexOf(targetTile);

                    var moveBackTile = GetMoveBackTile(_isDragTail, true);
                    if (moveBackTile)
                    {
                        offsetCheck = GetDirectionNonRounded(moveBackTile.transform.position -
                                                             targetTile.transform.position);
                    }
                    else
                    {
                        var adjacentOccupiedTile =
                            occupiedTiles[!_isDragTail ? targetTileIndex - 1 : targetTileIndex + 1];
                        offsetCheck = GetDirectionNonRounded(occupiedTiles[targetTileIndex].transform.position -
                                                             adjacentOccupiedTile.transform.position);
                    }

                    offsetCheck = offsetCheck.normalized * (targetTileToAdjacent.magnitude -
                                                            (offsetPos - adjacentInteractTile.gridPos)
                                                            .magnitude);
                }

                var isMoveFromTail = isNormalMove ? _isDragTail : !_isDragTail;
                _currentSelectSnake.FollowCursorWithinTile(targetTile, isMoveFromTail, offsetCheck);
            }
        }


        // private void OnDrawGizmos()
        // {
        //     if (!_currentSelectSnake)
        //         return;
        //     var start = _currentSelectSnake.head.transform.position + Vector3.up;
        //     Gizmos.DrawLine(start, start + _offsetMouse);
        // }
        
        #endregion

        #region Helper method

        public static Vector2Int GetDirection(Vector3 offset)
        {
            var offsetCheck = Vector2Int.zero;

            if (Math.Abs(offset.x) >= Math.Abs(offset.z))
            {
                var xOffset = Mathf.RoundToInt(offset.x);
                if (xOffset > 0) offsetCheck = Vector2Int.right;
                if (xOffset < 0) offsetCheck = Vector2Int.left;
            }
            else
            {
                var yOffset = Mathf.RoundToInt(offset.z);
                if (yOffset > 0) offsetCheck = Vector2Int.up;
                if (yOffset < 0) offsetCheck = Vector2Int.down;
            }

            return offsetCheck;
        }

        public static Vector2Int GetDirectionInverted(Vector3 offset)
        {
            var offsetCheck = Vector2Int.zero;

            if (Math.Abs(offset.x) < Math.Abs(offset.z))
            {
                var xOffset = Mathf.RoundToInt(offset.x);
                if (xOffset > 0) offsetCheck = Vector2Int.right;
                if (xOffset < 0) offsetCheck = Vector2Int.left;
            }
            else
            {
                var yOffset = Mathf.RoundToInt(offset.z);
                if (yOffset > 0) offsetCheck = Vector2Int.up;
                if (yOffset < 0) offsetCheck = Vector2Int.down;
            }

            return offsetCheck;
        }

        public static Vector2 GetDirectionNonRounded(Vector3 offset)
        {
            var offsetCheck = Math.Abs(offset.x) >= Math.Abs(offset.z)
                ? new Vector2(offset.x, 0)
                : new Vector2(0, offset.z);

            return offsetCheck;
        }





        public static Vector2Int GetDirectionNormalized(Vector3 offset)
        {
            var offsetCheck = Math.Abs(offset.x) >= Math.Abs(offset.z)
                ? new Vector2Int(Math.Sign(offset.x), 0)
                : new Vector2Int(0, Math.Sign(offset.z));

            return offsetCheck;
        }

        public static Vector2Int GetDirectionNormalizedInverted(Vector3 offset)
        {
            var offsetCheck = Math.Abs(offset.x) < Math.Abs(offset.z)
                ? new Vector2Int(Math.Sign(offset.x), 0)
                : new Vector2Int(0, Math.Sign(offset.z));

            return offsetCheck;
        }

        #endregion
    }
}
`;

const gridObjectDraggerContext = `using System;
using System.Collections.Generic;
using DG.Tweening;
using UnityEngine;
using UnityEngine.EventSystems;
using System.Collections;

namespace IEC
{
    public class GridObjectDragger : _BaseBehaviour
    {
        private enum State
        {
            None,
            Dragging,
        }

        private const float Epsilon = 0.25f;

        public MovableObject movableObject;

        private State _currentState;

        private Vector3 _mouseOffset;
        private void Update()
        {
            if (_currentState == State.Dragging)
            {
                SmoothMoveToNewPosition(GetMousePositionOnPlane() + _mouseOffset);
            }
        }

        private void ChangeState(State state)
        {
            if (_currentState == state) return;
            // Exit current state
            switch (_currentState)
            {
                case State.None: break;
                case State.Dragging:
                    ExitDrag();
                    break;
            }

            _currentState = state;
            // Enter new state
            switch (_currentState)
            {
                case State.None: break;
                case State.Dragging:
                    OnDrag();
                    break;
            }
        }

        private bool IsCrossABlocker(GridTile startTile, int direction, bool isHorizontal, out GridTile blocker)
        {
            blocker = null;
            if (isHorizontal)
            {
                var (limit, step) = direction < 0 ? (99, 1) : (-99, -1);
                for (var i = startTile.gridPos.x; i != limit; i += step)
                {
                    var nextGridTile = InGame.gridManager.GetGridTile(i + step, startTile.gridPos.y);
                    if (nextGridTile != null && nextGridTile.status == GridStatus.Empty && !nextGridTile.IsActiveColorPlane) continue;
                    if (nextGridTile != null && nextGridTile.movableObject && nextGridTile.movableObject == movableObject) continue;
                    blocker = InGame.gridManager.GetGridTile(i, startTile.gridPos.y);
                    return true;
                }
            }
            else
            {

                var (limit, step) = direction < 0 ? (99, 1) : (-99, -1);
                for (var i = startTile.gridPos.y; i != limit; i += step)
                {
                    var nextGridTile = InGame.gridManager.GetGridTile(startTile.gridPos.x, i + step);
                    if (nextGridTile != null && nextGridTile.status == GridStatus.Empty && !nextGridTile.IsActiveColorPlane) continue;
                    if (nextGridTile != null && nextGridTile.movableObject && nextGridTile.movableObject == movableObject) continue;
                    blocker = InGame.gridManager.GetGridTile(startTile.gridPos.x, i);
                    return true;
                }
            }

            return false;
        }

        #region Pointer event

        private Vector3 _colliderOffset;
        private Vector2Int _fromPos;
        private Vector2Int _toPos;

        public void OnPointerDown(BaseEventData eventData)
        {
            if (InGame.gameState == GameState.UsingHelper)
            {
                return;
            }
            
            switch (_currentState)
            {
                case State.None:
                    _fromPos = InGame.gridManager.GetGridTile(movableObject.transform.position).gridPos;
                    _colliderOffset = gameObject.GetComponent<Collider>().transform.position -
                                      movableObject.transform.position;
                    //to make object fly a bit from ground
                    _colliderOffset += new Vector3(0, -0.3f, 0);
                    ChangeState(State.Dragging);
                    break;
                case State.Dragging:
                    break;
            }
            
        }

        public void OnPointerUp(BaseEventData eventData)
        {
            if (_currentState != State.Dragging) return;
            ChangeState(State.None);
            _colliderOffset = Vector3.zero;
            _toPos = InGame.gridManager.GetGridTile(movableObject.transform.position).gridPos;
        }

        private void OnDisable()
        {
            ChangeState(State.None);
            movableObject.ClearOccupiedTiles();
        }

        #endregion

        #region Drag move handle

        public Action<bool> onDrag;
        private void OnDrag()
        {
            var currentPos = transform.position - _colliderOffset;
            var mousePos = GetMousePositionOnPlane();
            _mouseOffset = currentPos - mousePos;
            onDrag?.Invoke(true);
        }
        private void ExitDrag()
        {
            movableObject.ClearOccupiedTiles();
            
            // Reset rotation to identity when drag ends
            movableObject.transform.rotation = Quaternion.identity;
                
            var targetedTile = InGame.gridManager.GetGridTile(movableObject.transform.position);
            movableObject.transform.position = targetedTile.transform.position;

            foreach (var tile in movableObject.tiles)
            {
                var grid = InGame.gridManager.GetGridTile(tile);
                movableObject.AddOccupiedTiles(grid);
            }
            onDrag?.Invoke(false);
        }

        private Vector3 GetMousePositionOnPlane()
        {
            return InGame.gridManager.GetMouseWorldPosition();
        }

        private void SmoothMoveToNewPosition(Vector3 targetPosition)
        {
            var currentPosition = movableObject.transform.position;
            var delta = targetPosition - currentPosition;
            
            if (movableObject.Direction != Direction.None)
            {
                switch (movableObject.Direction)
                {
                    case Direction.Vertical:
                        delta.x = 0;
                        break;
                    case Direction.Horizontal:
                        delta.z = 0;
                        break;
                }
            }

            delta *= GameConst.DragObjectSpeed * Time.deltaTime;
            if (delta.magnitude > 0.5f)
            {
                delta = delta.normalized * 0.5f;
            }

            var predictedPosition = currentPosition + delta;
            if (delta.x != 0)
                ProcessMovement(-delta.x, true, ref predictedPosition);
            if (delta.z != 0)
                ProcessMovement(-delta.z, false, ref predictedPosition);
            
            // Get final movement delta after collision checks
            Vector3 finalDelta = predictedPosition - currentPosition;
                
            // Apply movement
            movableObject.transform.position += finalDelta;
        }

        private void ProcessMovement(float deltaValue, bool isXAxis, ref Vector3 newPosition)
        {
            foreach (var tile in movableObject.tiles)
            {
                var tilePosition = tile;
                var offset = tilePosition - movableObject.transform.position;
                var gridTile = InGame.gridManager.GetGridTile(tilePosition);

                var extraGridTile = GetExtraGridTile(gridTile, tilePosition, isXAxis);

                // if (offset.z < 0) offset = -offset;
                AdjustPositionIfBlocked(deltaValue, isXAxis, gridTile, offset, ref newPosition);

                if (extraGridTile != null)
                {
                    AdjustPositionIfBlocked(deltaValue, isXAxis, extraGridTile, offset, ref newPosition);
                }
            }
        }

        private GridTile GetExtraGridTile(GridTile gridTile, Vector3 tilePosition, bool isXAxis)
        {
            if (gridTile == null) return null;
            var gridTilePosition = gridTile.transform.position;
            if (isXAxis)
            {
                return tilePosition.z - gridTilePosition.z < -Epsilon
                    ? InGame.gridManager.GetGridTileNeighbor(gridTile, Vector2Int.up)
                    : tilePosition.z - gridTilePosition.z > Epsilon
                        ? InGame.gridManager.GetGridTileNeighbor(gridTile, Vector2Int.down)
                        : null;
            }

            return tilePosition.x - gridTilePosition.x < -Epsilon
                ? InGame.gridManager.GetGridTileNeighbor(gridTile, Vector2Int.left)
                : tilePosition.x - gridTilePosition.x > Epsilon
                    ? InGame.gridManager.GetGridTileNeighbor(gridTile, Vector2Int.right)
                    : null;
        }

        private void AdjustPositionIfBlocked(float deltaValue, bool isXAxis, GridTile gridTile, Vector3 offset,
            ref Vector3 newPosition)
        {
            if (!IsCrossABlocker(gridTile, (int)Mathf.Sign(deltaValue), isXAxis, out var blocker)) return;

            var blockerPosition = blocker.transform.position;

            if (isXAxis)
                AdjustPosition(ref newPosition.x, offset.x, blockerPosition.x, deltaValue);
            else
                AdjustPosition(ref newPosition.z, offset.z, blockerPosition.z, deltaValue);
        }

        private void AdjustPosition(ref float newPosition, float offset, float blockerPosition, float deltaValue)
        {
            if (deltaValue > 0)
            {
                if (newPosition + offset < blockerPosition)
                    newPosition = blockerPosition - offset;
            }
            else
            {
                if (newPosition + offset > blockerPosition)
                    newPosition = blockerPosition - offset;
            }
        }

        #endregion
    }
}
`;

const contextFiles: Record<string, string> = {
  'BaseBehaviour.cs': baseBehaviourContext,
  'GridInputHandler.cs': gridInputHandlerContext,
  'GridObjectDragger.cs': gridObjectDraggerContext,
};

const filesWithBaseClass = ['GridInputHandler.cs', 'GridObjectDragger.cs'];

export const AiMechanicCoderPanel: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState('');
    const [error, setError] = useState('');
    const [selectedContextFile, setSelectedContextFile] = useState('GridInputHandler.cs');

    const handleGenerate = useCallback(async () => {
        if (!prompt) {
            setError('Please enter a prompt.');
            return;
        }

        setIsLoading(true);
        setError('');
        setResult('');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            
            let systemInstruction = `You are an expert C# Unity game developer. The user wants to modify the C# script '${selectedContextFile}'. Your task is to provide the complete, updated C# code for the file. Only output the raw C# code, without any markdown formatting, explanations, or enclosing tags.`;
            
            let contextCode = contextFiles[selectedContextFile];

            if (filesWithBaseClass.includes(selectedContextFile)) {
                systemInstruction = `You are an expert C# Unity game developer. The user wants to modify the C# script '${selectedContextFile}', which inherits from 'BaseBehaviour'. The code for BOTH files is provided below for full context. Your task is to provide the complete, updated C# code for the '${selectedContextFile}' file. Only output the raw C# code, without any markdown formatting, explanations, or enclosing tags.`;
                contextCode += `\n\n// --- Base Class Context (Do Not Modify) ---\n${baseBehaviourContext}`;
            }

            const fullPrompt = `${prompt}\n\n--- C# Context ---\n${contextCode}`;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: fullPrompt,
                config: {
                    systemInstruction: systemInstruction,
                }
            });

            const text = response.text;
            setResult(text);

        } catch (e: any) {
            setError(`An error occurred: ${e.message}`);
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, [prompt, selectedContextFile]);

    const handleCopyToClipboard = () => {
        navigator.clipboard.writeText(result).then(() => {
            alert('Code copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    };
    
    return (
        <div className="mt-4 pt-4 border-t border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-3">AI Mechanic Coder</h2>
            <div className="flex flex-col gap-3">
                <div>
                    <label htmlFor="contextFile" className="block text-sm font-medium text-gray-300 mb-1">
                        C# Context File
                    </label>
                    <select
                        id="contextFile"
                        value={selectedContextFile}
                        onChange={(e) => setSelectedContextFile(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-teal-500 focus:border-teal-500"
                    >
                        {Object.keys(contextFiles).map(filename => (
                            <option key={filename} value={filename}>{filename}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="aiPrompt" className="block text-sm font-medium text-gray-300 mb-1">
                        Prompt
                    </label>
                    <textarea
                        id="aiPrompt"
                        rows={3}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., 'Add a double-jump ability'"
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-teal-500 focus:border-teal-500"
                    />
                </div>
                <button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold text-white transition-all transform hover:scale-105 disabled:bg-gray-500 disabled:cursor-not-allowed disabled:transform-none"
                >
                    {isLoading ? 'Generating...' : 'Generate Code'}
                </button>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                {result && (
                    <div className="relative">
                        <textarea
                            readOnly
                            value={result}
                            rows={10}
                            className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 text-sm text-gray-300 font-mono resize-y"
                        />
                        <button
                            onClick={handleCopyToClipboard}
                            className="absolute top-2 right-2 px-2 py-1 bg-gray-600 hover:bg-gray-500 text-white text-xs font-bold rounded"
                        >
                            Copy
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
