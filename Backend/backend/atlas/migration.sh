source ./env.sh
atlas migrate diff --to file://schema.sql --dir 'file://./migrations' --dev-url $POSTGRES_URL
