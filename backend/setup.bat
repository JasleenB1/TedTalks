@echo off
REM TedTalks Backend Setup Script for Windows

echo.
echo ========================================
echo TedTalks Backend Setup
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://www.python.org/
    exit /b 1
)

echo Python found!
python --version

REM Check if .env exists
if not exist ".env" (
    echo.
    echo Creating .env file from template...
    copy .env.example .env
    echo.
    echo ⚠️  Please edit .env with your MongoDB URI and configuration
    echo.
    pause
) else (
    echo .env file already exists
)

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    echo.
    echo Creating virtual environment...
    python -m venv venv
    echo Virtual environment created!
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install dependencies
echo.
echo Installing dependencies...
pip install -r requirements.txt

if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    exit /b 1
)

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo To start the server:
echo   1. Run: venv\Scripts\activate.bat
echo   2. Run: python main.py
echo.
echo API Documentation: http://localhost:8000/docs
echo.
pause
