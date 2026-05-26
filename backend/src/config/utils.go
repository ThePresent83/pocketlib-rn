package config

import (
	"net/url"
	"strconv"
	"time"

	"github.com/sosodev/duration"
)

func parseBool(value string) (*bool, error) {
	val, err := strconv.ParseBool(value)
	return &val, err
}

func parseBoolWithDefault(defaultValue bool) ParseFunc[bool] {
	return func(value string) (*bool, error) {
		if value == "" {
			return &defaultValue, nil
		}
		return parseBool(value)
	}
}

func parseURLWithDefault(defaultValue string) ParseFunc[url.URL] {
	return func(value string) (*url.URL, error) {
		if value == "" {
			value = defaultValue
		}
		return url.Parse(value)
	}
}

func parseInt(value string) (*int, error) {
	val, err := strconv.ParseInt(value, 10, 64)
	i := int(val)
	return &i, err
}

func parseIntWithDefault(defaultValue int) ParseFunc[int] {
	return func(value string) (*int, error) {
		if value == "" {
			return &defaultValue, nil
		}
		return parseInt(value)
	}
}

func intToString(value int) string {
	return strconv.FormatInt(int64(value), 10)
}

func parseTimeout(value string) (*time.Duration, error) {
	d, err := duration.Parse(value)
	if err != nil {
		return nil, err
	}
	td := d.ToTimeDuration()
	return &td, nil
}
