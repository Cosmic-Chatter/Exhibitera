if [ -z "$1" ]
  then
    echo "You must pass the path for the build as an argument."
    exit 1
fi

source "$1/venv/bin/activate" || exit 1
cd "$1" || exit 1
pyinstaller --clean --onefile \
            --add-data "*.html:."\
            --add-data "*.md:."\
            --add-data "*.txt:."\
            --add-data "api/:api/." \
            --add-data "js/:js/." \
            --add-data "css/:css/." \
            --add-data "_fonts/:_fonts/." \
            --add-data "dmx_control/:dmx_control/." \
            --add-data "image_compare/:image_compare/." \
            --add-data "infostation/:infostation/." \
            --add-data "media_browser/:media_browser/." \
            --add-data "media_player/:media_player/." \
            --add-data "other/:other/." \
            --add-data "_static/:_static/." \
            --add-data "timelapse_viewer/:timelapse_viewer/." \
            --add-data "timeline_explorer/:timeline_explorer/." \
            --add-data "voting_kiosk/:voting_kiosk/." \
            --add-data "word_cloud/:word_cloud/." \
            Exhibitera_Apps.py