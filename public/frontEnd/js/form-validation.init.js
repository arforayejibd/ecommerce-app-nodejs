$(document).ready(function(){
    $(".parsley-examples").parsley();
});

$(function(){
    var demoForm = $("#demo-form");
    if (demoForm.length && typeof demoForm.parsley === "function") {
        var parsleyInstance = demoForm.parsley();
        if (parsleyInstance) {
            parsleyInstance.on("field:validated", function(){
                var e = 0 === $(".parsley-error").length;
                $(".alert-info").toggleClass("d-none", !e);
                $(".alert-warning").toggleClass("d-none", e);
            }).on("form:submit", function(){
                return false;
            });
        }
    }
});