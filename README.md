# JiraList

Live, public instance (running on OpenShift): https://jiralist-apilord.rhcloud.com

## The Problem

JBoss JIRA is great and we want to make sure we capture all of our work
as JIRA issues, but it can be quite slow, especially when trying to
break down project work into fine grained tasks.  How can we use
something like Wunderlist, but still have the tasks end up in JIRA?

## The Solution

It's basically a way to do *most* of what I need to do in JIRA, but do
it in a faster and more streamlined way.  It's an angularjs app that
uses the JIRA API to provide a Wunderlist style interface on top of
JIRA.  You basically create "lists" in the interface, where each list
consists of:

* List Name
* JIRA Project
* Version

From this you get a list of JIRA issues for that version.  The
following actions are supported per item in the list:

* Start Progress
* Stop Progress
* Mark as Done

You can also create new issues.

All of these actions happen quickly, because the UI doesn't wait for the
API call to complete.  It just assumes everything will work out OK, so
it lets you go about your business immediately.  All the JIRA API calls
happen in the background.  The result is a UI that is very responsive,
even when JIRA is not.


## Security Note #1

No information is stored on the server.  The configuration of your lists
is stored in HTML5 local storage.  So even though it's asking for your
username/password (so it can make authenticated REST calls to JIRA) that
info gets stored in your browser.  If you're not comfortable with that,
I understand.


## Security Note #2

Because JIRA's CORS support does not work with BASIC auth (they don't
allow the Authorization header) we can't make authenticated calls
directly to JIRA.  So JIRA-List also includes a CORS proxy.  So all JIRA
REST API calls are actually going through the JIRA-List proxy...again
without storing anything.  If you use https this should be reasonably
secure, but again you should be aware of what is happening.

## Other Notes

I originally created this tool just for the apiman team, but was
encouraged to share it more broadly in case others found it useful.
This means that you should expect a lot of rough edges, as it wasn't
intended to be bullet proof.  Error handling is terrible, for example.
The feature-set may be pretty specific to our needs and not yours.  But
I'd be happy to have feedback and/or contributions.