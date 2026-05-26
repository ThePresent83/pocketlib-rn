source ./env.sh
atlas migrate apply --dir "file://./migrations" --url "$POSTGRES_URL" 10000000
