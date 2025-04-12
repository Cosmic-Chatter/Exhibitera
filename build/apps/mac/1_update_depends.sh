if [ -z "$1" ]
  then
    echo "You must pass the path for the build as an argument."
    exit 1
fi

source "$1/venv/bin/activate" || exit 1
python -m pip install --upgrade pip
python -m pip install --upgrade -r "$1/exhibitera/apps/requirements.txt"
python -m pip install --upgrade pyinstaller
